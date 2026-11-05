# �tat actuel et roadmap

**5 novembre - raccordement Admin  Engine pr�par� dans une PR :** les actions
Creator existantes (validation, aper�u, tests de correction) sont reli�es � un
transport serveur HTTPS strict vers `https://staging.novlearn.fr/run` lorsque
Admin est sur Vercel. Package Admin 0.1.8 conserv� ; contrat host v�rifi� contre
le code Engine 0.2.1. Les tests simul�s et contr�les seront consign�s dans la
PR. L'acc�s r�el depuis Vercel, la version de l'image servie et la r�ception
navigateur restent � �tablir ; DNS depuis l'environnement courant renvoie
`ENOTFOUND`. Aucun d�ploiement n'est d�clench�. Voir
[transport Admin-Engine](admin-engine-transport.md).

**Prochaine mission arr�t�e :** [terminer Admin, Engine et quatre/cinq pilotes](mission-admin-engine.md),
avec le [prompt de lancement](prompt-mission-admin-engine.md). NovLearn reste en
lecture seule pendant cette mission ; son adaptation d�veloppement fera l'objet
d'une seconde conversation et d'un prompt fond� sur la r�ception r�elle du pilote.
La mission est engag�e : [dossier de r�ception](mission-admin-engine-reception.md).
Le banc connect� a constat� le refus du host sur le profil Vercel actuel.
L'utilisateur demande une [explication avant de d�cider de l'h�bergement](prompt-explication-hebergement-engine.md) ;
aucune nouvelle infrastructure ou Function conteneuris�e n'est autoris�e � ce stade.
Archive 0.1.1, correctif num�rique, builder et contr�les locaux pr�par�s ;
d�ploiement de qualification Vercel autoris�. La r�ception distante et les
pilotes restent � faire. Aucun d�marrage de NovLearn classique ni �criture Production.

**3 novembre - identit� Engine Admin :** `package.json`, le lockfile, l'identit�
et le manifeste Admin d�signent l'archive 0.1.8 (SHA256
`82e499726db2da454627903ed65802eaa2ab3e7185f7f6cb3c84c1cbdbde3cea`). Le
contrat/pipeline reste schema 5 / Engine 0.1.0. La capacit� optionnelle de
sampling des courbes n'est pas activ�e dans l'adaptateur d'aper�u Admin ; le
travail Engine 0.2.0 reste non adopt�. Cette mise � jour statique ne prouve pas
la disponibilit� d'un host ni la r�ception NovLearn.

**30 octobre - simplification propos�e :** le [plan catalogue, builder et publication](plan-simplification.md)
d�crit les s�lecteurs de r�f�rences, les cases Flash/calculatrice, la difficult�,
la reprise des exercices historiques et un parcours de publication plus court.
Pr�cision utilisateur : exercices publi�s d'abord en pr�production, promotion
s�lective vers production ; flashcards publi�es directement en production via
un circuit distinct. Adapter NovLearn avec quatre/cinq exercices pilotes avant
la conversion g�n�rale. D�cision trac�e dans le plan ; CDC � aligner explicitement
avant r�alisation du nouveau p�rim�tre flashcards.
Analyse et documentation uniquement ; aucun de ces nouveaux lots n'est impl�ment�.

**30 octobre - configuration regroup�e :** un seul `.env` priv� � la racine ;
les quatre exemples sont remplac�s par le mod�le de [configuration](auth.md).
Le message de connexion d�crit d�sormais une configuration incompl�te.
Apr�s confirmation explicite de l'utilisateur, les marqueurs d'activation Auth
sont retir�s. Cible retenue : Production Vercel, trois variables et base de
pr�production existante. Session/r�le, permissions et s�paration avec la base
de production �l�ves restent contr�l�s. Engine reste ferm� sur Vercel.
D�ploiement Production r�alis� et formulaire actif v�rifi� sur le domaine r�el ;
refus des visiteurs non connect�s confirm�s. Connexion r�elle et parcours connect�
restent � recevoir : voir la [preuve et ses limites](vercel.md#v�rification-du-30-octobre-2026).

**22 octobre - lot 2, distribution Engine :** le [contrat de biblioth�que](engine-library.md)
formalise l'archive qualifi�e 0.1.0, ses exports, diagnostics et compatibilit�.
Manifeste/inventaire complet et consommateurs minimaux Admin/NovLearn ajout�s ;
installation reproductible et contrats test�s. Ni adoption 0.2.0, ni raccordement
�l�ve, ni qualification d'un nouvel h�te. L'�tat D13 ci-dessous reste inchang�.

Relecture documentaire du **21 octobre 2026**, � partir du code au commit
`c2064bf13c0c20b094e30a9eb834869ff4420f3f` et des preuves conserv�es. Le d�p�t
�tait propre au d�marrage de cette mission. Aucun service, compte ou
environnement distant n'a �t� requalifi� pendant ce nettoyage.

## �tat retenu

Le dernier profil pr�par� (D13) conserve Supabase Staging r�el et retire les
instances Docker Admin apr�s sauvegarde. Le frontend local se lance sans Docker.
Au moment de D13, **aucun d�ploiement ni r�ception Vercel n'�tait prouv�** ;
le d�ploiement et les contr�les HTTP du 30 octobre sont consign�s ci-dessus.
Une ancienne URL locale r�pondant correctement n'�tablit pas sa disponibilit�
actuelle.

**L'utilisation d'Engine est centrale dans le CDC. Le profil Vercel qui le
d�sactive est une pr�paration incompl�te, pas une livraison acceptable de
l'Admin attendu.** La r�duction ant�rieure du p�rim�tre ne permet pas de
pr�senter un �diteur sans moteur comme achev�.

| Domaine                                    | Impl�ment� dans le d�p�t                                                      | V�rifications disponibles                                                           | �tat du profil D13 / reste                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Auth Staging                               | Connexion, r�le serveur, refus invit�s, expiration                            | Connexion r�elle D12 ; tests et refus HTTP D13                                      | Configurable, sans nouvelle r�ception navigateur ici                                                   |
| Catalogue et versions                      | Recherche, filtres, brouillons, r�visions, duplication, archivage et conflits | SQL/HTTP locaux ; catalogue et brouillon n�121 sauvegard� puis relu sur Staging D12 | Raccord� � Staging ; ne pas d�duire une r�ception de toutes les actions                                |
| Creator / MathLive                         | �diteur canonique, champs avanc�s, gardes de sortie, r�cup�ration facultative | Tests unitaires/serveur ; parcours humain local limit�                              | Raccord� ; r�ception compl�te du clavier, focus, navigation et types avanc�s restante                  |
| Engine / aper�u / correction               | Adaptateur officiel, worker born�, tests multi-seeds et projection publique   | Archive 0.1.0 exacte qualifi�e Linux ; parcours connect�s locaux historiques        | **D�sactiv�** par le lanceur Staging actuel et sur Vercel ; h�te op�rationnel � qualifier et raccorder |
| Rapports et relecture                      | Re�us sign�s li�s � une r�vision, historique, approbation humaine             | SQL/Engine/HTTP sur bancs locaux                                                    | **D�sactiv�s**, aucune cl� Staging provisionn�e ; d�cision de signature et r�ception requises          |
| Chapitres, comp�tences, flashcards         | Gestion Staging et contr�les de r�f�rences                                    | Tests SQL/API locaux                                                                | Raccord�s dans le p�rim�tre Staging ; pas de preuve de r�ception compl�te de chaque CRUD distant       |
| Dashboard catalogue                        | Agr�gats du catalogue et r�f�rentiel Staging                                  | Tests et SQL locaux                                                                 | Code pr�sent ; r�ception sur le profil actuel � compl�ter                                              |
| Statistiques / utilisateurs                | Agr�gats, filtres p�dagogiques, liste et fiche utilisateur                    | Copies synth�tiques, PostgreSQL/TLS et Auth/HTTP locaux                             | Lecteurs locaux non remis en service ; aucune lecture Production op�rationnelle prouv�e                |
| Version active cible                       | Lecture du pointeur actif, diff�rente de la derni�re r�vision                 | Cible locale SQL70, refus et rollback                                               | Lecteur local non r�activ� ; acc�s op�rationnel restant                                                |
| Publication individuelle, lots et rollback | Diff, confirmation, journal, transfert et reprise apr�s issue incertaine      | SQL/HTTP sur **copies locales**, simulations UI distinctes                          | **D�sactiv�e** ; aucune publication Supabase Production livr�e                                         |
| Courbes Engine 0.2.0 (D10)                 | Travail propri�taire d�crit par une preuve dat�e                              | Phases package Linux r�ussies, contr�le source complet non r�ussi                   | Report� ; archive non adopt�e dans Admin                                                               |
| H�bergement / exploitation                 | Configuration Vercel, build autonome et en-t�tes                              | Contr�le local D13 ; pas de r�ception sur domaine h�berg�                           | D�ploiement restant, sous autorisation distincte ; d�pendance Engine non r�solue                       |

## Port�e des preuves r�centes

- **D12, Staging :** la preuve SQL atteste l'application du bundle
  `20261021120707`, 286 assertions inchang�es sur restauration cibl�e, 147 lignes
  p�dagogiques initiales et 70 anciennes entr�es de migration pr�serv�es.
  La r�ception applicative distincte confirme connexion, catalogue, sauvegarde
  du brouillon n�121 et lectures de sa fiche. Elle ne prouve pas une reconnexion
  ult�rieure ni tous les parcours du CDC.
- **D13, pr�paration Vercel :** la preuve conserve 1 531 tests / 80 fichiers,
  int�grit� Engine, types, lint, format, build et smoke r�ussis � cette date.
  Les sept observations HTTP sans Docker incluent les refus Engine/aper�u 503.
  Ce r�sultat ne d�montre pas un moteur utilisable dans cette pr�paration.
- Le banc D11 a subi une **restauration partielle** : six des 18 exercices et
  neuf des 23 rapports ant�rieurs au nettoyage ont �t� r�cup�r�s � cette �tape.
  La sauvegarde finale D13 contient ensuite sept exercices et dix rapports.
  Ces chiffres d�crivent des �tapes diff�rentes ; ils ne prouvent pas que les
  donn�es r�centes manquantes ont �t� retrouv�es.

Les liens vers ces preuves et leurs limites sont dans
[V�rifications](verification.md). Les comptes rendus et anciens �tats Git sont
consultables dans l'historique, sans maintenir une seconde chronologie active.

## Travail restant et portes de r�ception

Le [plan de r�alisation](plan-realisation.md) d�taille les lots, d�pendances et
crit�res d'acceptation d'Admin, d'Engine comme biblioth�que et de NovLearn
classique. L'application native est une extension hors chemin critique.

La sauvegarde actuelle contr�le l'enveloppe du brouillon (`draftEnvelope`), sans
validation math�matique Engine compl�te. C'est un �cart � l'exigence de validation
avant sauvegarde du CDC (�16), � r�soudre explicitement : ne pas pr�senter
l'acceptation d'un brouillon incomplet comme conforme � cette exigence ni modifier
le CDC sans d�cision trac�e.

1. Choisir et qualifier l'h�te Engine officiel, puis raccorder le parcours
   authentifi� : validation, g�n�ration par seed, projection et correction.
   Conserver d�lais, quotas et protections. Aucune substitution par MathLive ou
   un �valuateur Admin, ni activation par simple drapeau sur Vercel.
2. Compl�ter la r�ception sur Staging et l'h�te retenu : sauvegarde, r�ouverture,
   reconnexion, conflits, r�cup�ration et interactions MathLive. Les �ventuels
   rapports persist�s et la relecture demandent leur capacit� de signature.
3. Avant toute extension distante, reprendre la r�conciliation SQL de la cible,
   les consommateurs historiques, les ACL/RLS et les sauvegardes/restaurations
   adapt�es. Le **Lot 1A reste incomplet** ; le bundle Staging n'est pas un delta
   universel ni une autorisation Production.
4. Reprendre uniquement les fonctions report�es explicitement retenues : courbes,
   lecteurs Production minimaux, version cible et publication s�lective. Chacune
   exige ses pr�requis, permissions et preuves sur la bonne cible.
5. Autoriser s�par�ment d�ploiement et mise en service, puis ex�cuter la r�ception
   sur le domaine r�el. Le **CDC complet n'est pas r�ceptionn�**.

Cet ordre d�crit les d�pendances ; il ne d�marre aucun lot ni n'autorise de
modification de code, de d�p�t voisin, de secret ou d'environnement distant.

