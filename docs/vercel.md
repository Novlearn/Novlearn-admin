# D�ploiement et exploitation

**Mise � jour du 5 novembre 2026 :** la PR de raccordement ajoute le transport
HTTPS serveur vers le host staging et conserve Engine ferm� tant que ses
variables serveur ne sont pas configur�es. Le code ne d�marre pas le host natif
sur Vercel. Voir [transport Admin-Engine](admin-engine-transport.md) pour la
configuration et les contr�les � refaire apr�s d�ploiement. Aucun d�ploiement ni
acc�s distant depuis Vercel n'est revendiqu� ici.
La mission du 30 octobre pr�pare maintenant un
[banc prot�g�](../src/app/admin/engine-qualification/page.tsx) avec un payload
serveur synth�tique et le host officiel. L'utilisateur a autoris� s�par�ment
son d�ploiement de qualification. Les op�rations d'�dition Engine restent
ferm�es sur Vercel. Voir le [dossier de r�ception](mission-admin-engine-reception.md)
pour l'archive 0.1.1 et les r�sultats nouveaux ; les observations ci-dessous
d�crivent le d�ploiement ant�rieur tant qu'une r�ception plus r�cente n'est pas consign�e.

## D�ploiement Production Vercel et base de pr�production

Le d�p�t contient [vercel.json](../vercel.json) et un
[guide de configuration unique](auth.md). Next.js utilise la
**base de pr�production existante**, historiquement nomm�e Supabase Staging.
Le 30 octobre, l'utilisateur a autoris� le d�ploiement Production Vercel avec
trois variables seulement et le retrait des marqueurs d'activation Auth.
L'environnement nomm� � Production � dans Vercel d�signe l'h�bergement, pas une
autorisation d'utiliser Supabase Production.

**Le profil propos� d�sactive Engine et ne constitue pas une livraison acceptable
de l'Admin attendu.** Ne pas d�clarer la mise en service achev�e tant que le
parcours officiel Engine n'est pas raccord� et qualifi� sur l'h�te retenu.
Le blocage est dans le code, pas seulement dans les variables : changer un
`false` en `true` sur Vercel ne l�ve pas la garde. La d�cision d'h�bergement doit
traiter l'isolation du moteur, son transport authentifi� et les snapshots priv�s
d'aper�u d�crits dans [l'architecture](architecture.md).

La qualification D13 reste historique. La r�ception du nouveau d�ploiement doit
distinguer formulaire disponible, refus non connect�s et connexion r�elle avec
le compte de l'utilisateur ; aucun succ�s de connexion n'est d�duit du formulaire.

## V�rification du 30 octobre 2026

Le d�ploiement `dpl_42RMJasZuoDnMonCm665vGkq84LV` est **READY**, cible
Production, sur [novlearn-admin.vercel.app](https://novlearn-admin.vercel.app).
Il provient des fichiers locaux, incluant les changements non commit�s ; aucun
push ni changement de donn�es ou de configuration Supabase n'a �t� effectu�.
La [preuve dat�e](archives/vercel-production-2026-10-30.json) conserve l'empreinte
des sources envoy�es et les r�sultats HTTP.

- Formulaire actif : HTTP 200, trois contr�les actifs, ancien `?error=disabled`
  sans alerte obsol�te ; donn�es de pr�production indiqu�es.
- Sans session : `/admin` redirige vers la connexion ; les API session et
  catalogue r�pondent 401. R�ponses priv�es `no-store`.
- Engine r�pond 503 : toujours indisponible sur cet h�te.
- Installation et build Vercel r�ussis. Localement : 1 533 tests dans 80 fichiers,
  types, lint sans erreur, build isol� et smoke du serveur r�ussis. Le lint
  conserve un avertissement historique sur une image du banc navigateur.
  `npm run check` reste en �chec sur le format de deux rapports archiv�s
  (`audit-v1-2026-10-21.md`, `plan-v1-2026-10-21.md`), conserv�s sans modification ;
  le build et le smoke ont donc �t� ex�cut�s s�par�ment avec succ�s.

La connexion r�elle avec un compte Admin, les sauvegardes de brouillon et leur
r�ouverture n'ont pas �t� test�es � distance pendant cette intervention.

## Pr�paration de l'h�bergement

1. Importer `BBuclon/Novlearn-admin`, branche `main`, racine du d�p�t, preset
   Next.js et Node 24.x. Les commandes versionn�es sont `npm ci` et
   `npm run build`. Leur pr�sence ne vaut pas v�rification des limites actuelles
   de l'offre d'h�bergement.
2. Utiliser `https://novlearn-admin.vercel.app` comme origine stable et renseigner
   les trois variables de pr�production d�crites
   dans [Auth](auth.md), notamment l'origine
   exacte dans `APP_BASE_URL` et la cl� publishable du bon projet.
3. Le profil pr�par� conserve � `false` les quatre portes Engine, transport
   Engine local Staging, relecture et publication. Leur absence conserve aussi
   ces capacit�s d�sactiv�es ; inutile de multiplier les valeurs `false`.
   Ne pas importer les variables `ADMIN_LOCAL_*`, cl�s priv�es, URL PostgreSQL,
   `.env`, dossiers `.local/` ou sauvegardes.
4. Ex�cuter les contr�les locaux, d�ployer le code autoris�, puis v�rifier le
   formulaire et les refus d'acc�s sur le domaine r�el. Ce d�ploiement rend le
   socle �ditorial accessible ; il ne vaut pas r�ception du parcours Engine.

Une origine Preview diff�rente de `APP_BASE_URL` est refus�e pour les mutations.
Utiliser une origine exacte propre � chaque environnement, sans joker. Une
modification des variables d'un d�ploiement demande un nouveau d�ploiement.

## R�ception sur le domaine r�el

Apr�s d�ploiement autoris�, consigner le domaine, la r�vision, la configuration
sans secrets, la date et le r�sultat de chaque parcours :

- Connexion avec le compte Admin Staging, ouverture du catalogue, cr�ation d'un
  brouillon d'essai, sauvegarde, r�ouverture, d�connexion puis reconnexion et lecture.
- MathLive, r�cup�ration facultative de saisie, conflits et messages d'erreur.
- Validation Engine, g�n�ration avec seed, projection �l�ve et correction par le
  moteur officiel. Un bouton masqu� ou une r�ponse 503 est une indisponibilit�.
- Refus des pages et API en fen�tre priv�e non connect�e, sans r�le Admin et avec
  une origine incorrecte ; aucune fuite de donn�es priv�es.
- Rapports/relecture uniquement si leur signature a �t� explicitement provisionn�e
  et qualifi�e. Publication uniquement avec sa proc�dure s�par�e approuv�e.

Les contr�les g�n�raux sont dans [V�rifications](verification.md). Une r�ception
HTTP, un test simul� ou un ancien parcours local ne remplace pas ces essais sur
l'h�te r�el. Les r�sultats manquants restent � faire.

## Incident, retour arri�re et sauvegardes

En cas de refus d'origine, contr�ler domaine et `APP_BASE_URL`. En cas de refus de
r�le, contr�ler le profil dans **Staging**, sans �largir les policies ni exposer
une cl� privil�gi�e. Ne pas rejouer un bundle SQL pour r�soudre un probl�me UI.
Un retour au d�ploiement pr�c�dent restaure le code, pas les donn�es Supabase.
Une restauration SQL et un rollback de publication sont des op�rations distinctes.

La preuve D13 enregistre le retrait des conteneurs Admin apr�s sauvegarde. Les
archives priv�es restent dans `.local/release-cleanup-20261021/backups/`, hors Git
et Docker : dump natif et archives des deux volumes, empreintes et lecture des
archives v�rifi�es. **Aucune nouvelle restauration de ces archives n'a �t�
ex�cut�e � cette �tape.** Ne pas d�duire leur restaurabilit� compl�te d'une simple
d�compression r�ussie. Elles ne constituent pas une sauvegarde int�grale du projet
Supabase, d'Auth ou de Storage.

Conserver les configurations priv�es et les autres sauvegardes existantes.
Avant une modification de donn�es autoris�e, adapter la sauvegarde � la cible,
prouver sa restauration isol�e et d�finir le retour arri�re. La disponibilit�
actuelle d'un processus local ou distant reste � v�rifier lors de l'exploitation.

