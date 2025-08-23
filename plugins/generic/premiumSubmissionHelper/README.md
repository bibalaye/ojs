# Premium Submission Helper Plugin

## Description

Plugin OJS qui ajoute un bouton "Lancer l'analyse IA" dans le formulaire de soumission d'articles. Seuls les utilisateurs avec le rôle Premium peuvent accéder à cette fonctionnalité.

## Fonctionnalités

- **Bouton d'analyse IA** : Intégré dans le formulaire de soumission
- **Contrôle d'accès Premium** : Seuls les utilisateurs Premium peuvent utiliser l'IA
- **Message d'incitation** : Affichage d'un message pour les utilisateurs non-Premium
- **Création automatique des rôles** : Création automatique du groupe Premium lors de l'activation
- **Permissions d'auteur** : Les utilisateurs Premium ont automatiquement les permissions d'auteur

## Installation

1. Copiez le dossier `premiumSubmissionHelper` dans `plugins/generic/`
2. Activez le plugin via l'interface d'administration OJS
3. Le groupe Premium sera créé automatiquement

## Configuration

### Rôles Premium

Le plugin crée automatiquement un groupe d'utilisateurs "Premium" avec :
- Rôle OJS : Auteur (`ROLE_ID_AUTHOR`)
- Permissions : Accès à l'analyse IA
- Permissions d'auteur : Soumission, édition, revue, etc.

### Attribution des Utilisateurs

1. Allez dans **Administration > Utilisateurs et Rôles > Groupes d'utilisateurs**
2. Sélectionnez le groupe "Premium"
3. Cliquez sur "Gérer les utilisateurs"
4. Ajoutez les utilisateurs souhaités

## Utilisation

### Pour les Utilisateurs Premium
- Le bouton "Lancer l'analyse IA" est visible dans le formulaire de soumission
- Accès complet aux fonctionnalités premium

### Pour les Utilisateurs Standard
- Message d'incitation à s'abonner au Premium
- Pas d'accès aux fonctionnalités IA

## Fichiers du Plugin

- `PremiumSubmissionHelperPlugin.php` - Plugin principal
- `settings.xml` - Configuration
- `version.xml` - Version
- `locale/` - Fichiers de traduction
- `js/` - JavaScript frontend
- `css/` - Styles CSS

## Support

Pour toute question ou problème, consultez la documentation OJS ou contactez l'équipe de développement.

## Licence


