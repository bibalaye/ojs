# 📋 Plan d'Implémentation - Plugin Premium Submission Helper

## 🎯 Objectif du Plugin
Le plugin **Premium Submission Helper** vise à améliorer la qualité des soumissions académiques en intégrant une analyse IA. **Seuls les utilisateurs avec le rôle Premium peuvent voir et utiliser le bouton d'analyse IA**, tandis que les utilisateurs non-premium voient un message d'incitation à s'abonner.

## 📁 Nom et Répertoire du Plugin
- **Nom** : Premium Submission Helper
- **Répertoire** : `plugins/generic/premiumSubmissionHelper/`
- **Type** : Plugin générique OJS

## 🔗 Hook OJS Utilisé
Pour injecter le contenu dans le formulaire de soumission, nous utilisons le hook OJS suivant :

### **Hook Principal :**
- `TemplateManager::display` - Pour injecter les ressources CSS/JS nécessaires et vérifier le statut premium

### **Cible d'Injection :**
- **Formulaire** : Formulaire de soumission OJS
- **Position** : Après le champ résumé (abstract) existant
- **Condition** : Vérification du statut premium de l'utilisateur

## 🔒 Gestion des Permissions Premium

### **Logique d'Accès :**
- **Rôle Premium** : Accès complet à l'analyse IA
- **Autres rôles** (Site Admin, Manager, Assistant, etc.) : **PAS d'accès** à l'IA
- **Création automatique** : Le groupe Premium est créé automatiquement lors de l'activation du plugin

### **Vérification Premium :**
```php
// Méthode simplifiée dans le plugin
private function isUserPremium($contextId)
{
    // Vérification directe si l'utilisateur est dans le groupe Premium
    // Retourne true uniquement pour les utilisateurs Premium
}
```

## 💻 Logique JavaScript Frontend

### **Architecture :**
1. **Détection du Formulaire** : Écoute des événements de rendu des composants de formulaire
2. **Vérification Premium** : Appel au plugin PHP pour vérifier le statut premium
3. **Injection Conditionnelle** : Affichage du bouton IA uniquement pour les utilisateurs premium
4. **Gestion des Événements** : Capture du clic sur le bouton et lancement de l'analyse

### **Fonctionnalités Clés :**
- **Injection Dynamique** : Le bouton IA est injecté après le champ résumé
- **Analyse en Temps Réel** : Envoi du résumé pour analyse
- **Affichage des Résultats** : Présentation des suggestions d'amélioration
- **Gestion des États** : Loading, succès, erreur avec feedback visuel

### **Sécurité :**
- **Vérification Premium** : Contrôle côté serveur uniquement
- **Validation des Données** : Sanitisation des entrées utilisateur
- **Gestion des Erreurs** : Messages d'erreur appropriés

## 🔒 Gestion des Permissions Premium

### **Logique d'Affichage :**
```javascript
// Pseudo-code de la logique
if (userIsPremium) {
    injectAIButton();
    showPremiumFeatures();
} else {
    hidePremiumFeatures();
    showUpgradeMessage();
}
```

### **Fallback pour Non-Premium :**
- Aucun bouton IA visible
- Message discret suggérant l'upgrade premium
- Fonctionnalité standard OJS préservée

## 📱 Interface Utilisateur

### **Éléments Visuels :**
- **Bouton IA** : Design moderne avec icône robot 🤖
- **Zone de Résultats** : Affichage structuré des suggestions
- **Indicateurs de Chargement** : Animation pendant l'analyse
- **Responsive Design** : Adaptation mobile et desktop

### **Localisation :**
- **Langues** : Français (fr_FR) et Anglais (en_US)
- **Traductions** : Tous les textes d'interface localisés
- **Format** : Fichiers .po pour facilité de maintenance

## 🚀 Déploiement et Tests

### **Phase de Test :**
1. **Test Local** : Vérification de l'injection dans l'environnement de développement
2. **Test Premium** : Validation de l'affichage pour les utilisateurs premium
3. **Test Non-Premium** : Confirmation de la non-visibilité pour les utilisateurs standard
4. **Test d'Intégration** : Validation complète dans le workflow de soumission OJS

### **Critères de Succès :**
- ✅ Bouton IA visible uniquement pour les utilisateurs premium
- ✅ Injection correcte après le champ résumé
- ✅ Analyse IA fonctionnelle
- ✅ Interface utilisateur intuitive et responsive
- ✅ Gestion appropriée des erreurs et états de chargement

## 📋 Fonctionnalités Implémentées

### **✅ Fonctionnalités Principales :**
- **Contrôle d'accès Premium** : Seuls les utilisateurs Premium ont accès à l'IA
- **Création automatique des rôles** : Groupe Premium créé automatiquement
- **Permissions d'auteur** : Utilisateurs Premium ont automatiquement les permissions d'auteur
- **Interface conditionnelle** : Bouton IA visible uniquement pour les utilisateurs Premium
- **Message d'incitation** : Affichage d'un message pour les utilisateurs non-Premium

### **🔧 Architecture Technique :**
- **Plugin principal** : `PremiumSubmissionHelperPlugin.php`
- **Hook OJS** : `TemplateManager::display`
- **Vérification Premium** : Méthode `isUserPremium()` simplifiée
- **Injection frontend** : JavaScript et CSS intégrés
- **Base de données** : Création automatique des groupes d'utilisateurs Premium

### **📁 Structure du Plugin :**
```
plugins/generic/premiumSubmissionHelper/
├── PremiumSubmissionHelperPlugin.php    # Plugin principal
├── README.md                            # Documentation
├── settings.xml                         # Configuration
├── version.xml                          # Version
├── index.php                            # Fichier d'index
├── locale/                              # Traductions
├── js/                                  # JavaScript
└── css/                                 # Styles CSS
```
