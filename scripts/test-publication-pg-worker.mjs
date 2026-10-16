// Fixed test commands only, inside the fixture's private Docker network.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { Client } from 'pg';
import { runTransferCommand } from '/target-worker.mjs';
import { runServiceCommand } from '/service-worker.mjs';
import { runSourceCommand } from '/source-worker.mjs';
import { runRollbackCommand } from '/rollback-worker.mjs';
import {
  createPublicationPgPools,
  PublicationJournal,
} from '/fixture/bundle/native.mjs';
const { config, actor, operationId } = JSON.parse(
  await readFile('/fixture/client.json', 'utf8'),
);
let pools, journal, actual;
let phase = 'idle';
const rejectPool = async (settings) => {
  const bad = createPublicationPgPools(settings);
  try {
    await assert.rejects(bad.source(), {
      message: 'Publication backend unavailable',
    });
  } finally {
    await bad.close();
  }
};
const commands = {
  rollbackPublishFirst: () => runRollbackCommand('publishFirst'),
  rollbackCreateSecond: () => runRollbackCommand('createSecond'),
  rollbackMissingSecond: () => runRollbackCommand('missingSecond'),
  rollbackPublishSecond: () => runRollbackCommand('publishSecond'),
  rollbackImplicitFirst: () => runRollbackCommand('implicitFirst'),
  rollbackLostFirst: () => runRollbackCommand('lostFirst'),
  rollbackRecoverLost: () => runRollbackCommand('recoverLost'),
  rollbackRepeatFirst: () => runRollbackCommand('repeatFirst'),
  rollbackRepublishSecond: () => runRollbackCommand('republishSecond'),
  rollbackActivateFirst: () => runRollbackCommand('activateFirst'),
  sourcePublish: () => runSourceCommand('publish'),
  sourceRepeat: () => runSourceCommand('repeat'),
  sourceLostBefore: () => runSourceCommand('lostBefore'),
  sourceRecoverBefore: () => runSourceCommand('recoverBefore'),
  sourceLostAfter: () => runSourceCommand('lostAfter'),
  sourceRecoverAfterRevoked: () => runSourceCommand('recoverAfter'),
  sourceRecordBlocked: () => runSourceCommand('recordBlocked'),
  sourceRecoverBlocked: () => runSourceCommand('recoverBlocked'),
  async oldSourceContract() {
    const sourceUrl = new URL(config.source.url);
    sourceUrl.pathname = '/target_fixture';
    const old = createPublicationPgPools({
      ...config,
      source: { ...config.source, url: sourceUrl.href },
    });
    try {
      await assert.rejects(old.source(), {
        message: 'Publication backend unavailable',
      });
    } finally {
      await old.close();
    }
    return { missingAtomicSourceRefused: true };
  },
  servicePublish: () => runServiceCommand('publish'),
  serviceRepeat: () => runServiceCommand('repeat'),
  serviceBadConfirmation: () => runServiceCommand('badConfirmation'),
  serviceFailedEngine: () => runServiceCommand('failedEngine'),
  serviceLostAfter: () => runServiceCommand('lostAfter'),
  serviceRecoverAfter: () => runServiceCommand('recoverAfter'),
  serviceCancel: () => runServiceCommand('cancel'),
  targetPublish: () => runTransferCommand('publish'),
  targetRepeat: () => runTransferCommand('repeat'),
  targetAbort: () => runTransferCommand('abort'),
  targetLostAfter: () => runTransferCommand('lostAfter'),
  targetRecoverAfter: () => runTransferCommand('recoverAfter'),
  targetLostBefore: () => runTransferCommand('lostBefore'),
  targetRecoverBefore: () => runTransferCommand('recoverBefore'),
  targetLostSocket: () => runTransferCommand('lostSocket'),
  targetRecoverSocket: () => runTransferCommand('recoverSocket'),
  async identity() {
    phase = 'construct-pools';
    pools = createPublicationPgPools(config);
    const tls = [];
    for (const [connect, role, login] of [
      [
        pools.source,
        'novlearn_publication_journal_executor',
        'novlearn_admin_journal_service',
      ],
      [
        pools.target,
        'novlearn_publication_executor',
        'novlearn_admin_publication_service',
      ],
    ]) {
      phase = 'connect-' + role;
      const connection = await connect();
      try {
        const row = (
          await connection.query(
            'SELECT current_user AS role,session_user AS login',
          )
        ).rows[0];
        // After SET ROLE the intentionally limited capability cannot observe
        // pg_stat_ssl for the LOGIN backend. Inspect the actual TLS socket;
        // granting monitoring privileges would widen the application role.
        const socket = connection.connection.stream;
        row.ssl = socket.encrypted === true;
        row.authorized = socket.authorized;
        row.version = socket.getProtocol();
        row.cipher = socket.getCipher().name;
        assert.equal(row.role, role);
        assert.equal(row.login, login);
        assert.equal(row.ssl, true);
        assert.equal(row.authorized, true);
        assert.match(row.version, /^TLSv1\.[23]$/);
        assert(row.cipher);
        tls.push(row);
      } finally {
        connection.release();
      }
    }
    phase = 'untrusted-certificate';
    await rejectPool({ ...config, source: { url: config.source.url } });
    await pools.close();
    pools = undefined;
    return { tls, untrustedCertificateRejected: true };
  },
  async wrongHost() {
    const ca = await readFile('/fixture/wrong-host.crt', 'utf8');
    const probe = new Client({
      connectionString: config.source.url,
      ssl: { ca, rejectUnauthorized: true },
      connectionTimeoutMillis: 3000,
    });
    try {
      await assert.rejects(probe.connect(), {
        code: 'ERR_TLS_CERT_ALTNAME_INVALID',
      });
    } finally {
      await probe.end();
    }
    await rejectPool({ ...config, source: { ...config.source, ca } });
    return { wrongHostnameRejected: true };
  },
  async inherit() {
    await rejectPool(config);
    return { roleDriftRejected: true };
  },
  async delegatedMembership() {
    await rejectPool(config);
    return { delegationRejected: true };
  },
  async prepareRecovery() {
    pools = createPublicationPgPools(config);
    let authCalls = 0;
    // Synthetic identity gateway. Keeping its stale Admin view after revocation
    // deliberately verifies that SQL independently checks the actual profile.
    const auth = {
      getVerifiedUser: async () => {
        authCalls++;
        return { id: actor, isAnonymous: false };
      },
      getProfileRole: async () => {
        authCalls++;
        return 'admin';
      },
    };
    journal = new PublicationJournal(auth, pools.source);
    assert.equal((await journal.pending()).items.length, 0);
    assert.equal(authCalls, 0);
    actual = await journal.get(operationId);
    assert.equal(actual.state, 'planned');
    await journal.claim(actual.id, actual.plan_digest, 'claim');
    await journal.withSourceLease(
      actual.id,
      actual.plan_digest,
      async (_operation, recheck) => {
        await recheck();
      },
    );
    const working = (await journal.pending()).items[0];
    assert.equal(working.id, actual.id);
    assert.equal(working.state, 'executing');
    return { dedicatedLeasePassed: true, executingRecordDecoded: true };
  },
  async recover() {
    const revoked = (await journal.pending()).items[0];
    assert.equal(revoked.id, actual.id);
    await assert.rejects(journal.get(actual.id), { code: 'forbidden' });
    await journal.record(revoked, 'executing', 'uncertain');
    const uncertain = (await journal.pending()).items[0];
    assert.equal(uncertain.state, 'uncertain');
    // No target apply call exists in this test: not_applied is a known fact.
    await journal.record(uncertain, 'uncertain', 'failed', null, 'not_applied');
    assert.equal((await journal.pending()).items.length, 0);
    await pools.close();
    pools = undefined;
    return {
      machineRecoveryAfterRevocation: true,
      staleHumanGatewayRejectedBySql: true,
    };
  },
};
process.stdout.write(JSON.stringify({ ready: true }) + '\n');
try {
  for await (const line of createInterface({ input: process.stdin })) {
    const { id, command } = JSON.parse(line);
    phase = command;
    try {
      assert(Object.hasOwn(commands, command));
      process.stdout.write(
        JSON.stringify({ id, result: await commands[command]() }) + '\n',
      );
    } catch (error) {
      // No URLs, passwords or driver error text cross the test pipe.
      process.stdout.write(
        JSON.stringify({
          id,
          error: error.name,
          code: error.code ?? null,
          phase,
          message:
            error instanceof assert.AssertionError
              ? error.message
              : 'Local integration command failed',
        }) + '\n',
      );
    }
  }
} finally {
  await pools?.close();
  await runTransferCommand('close');
  await runServiceCommand('close');
}
