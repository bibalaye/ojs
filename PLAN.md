# 📋 Plan d'Implémentation - Plugin Premium Submission Helper

## 🎯 Objectif du Plugin
Le plugin **Premium Submission Helper** vise à améliorer la qualité des soumissions académiques en intégrant une analyse IA Santaane. **Seuls les utilisateurs premium peuvent voir et utiliser le bouton d'analyse IA**, tandis que les utilisateurs non-premium ne verront pas cette fonctionnalité.

## 📁 Nom et Répertoire du Plugin
- **Nom** : Premium Submission Helper
- **Répertoire** : `plugins/generic/premiumSubmissionHelper/`
- **Type** : Plugin générique OJS

## 🔗 Hook OJS Utilisé
Pour injecter le contenu dans le formulaire de soumission, nous utiliserons les hooks OJS suivants :

### **Hooks Principaux :**
- `Form::config::before` - Pour modifier la configuration du formulaire avant rendu
- `Form::config::after` - Pour ajouter des champs personnalisés après la configuration
- `TemplateManager::display` - Pour injecter les ressources CSS/JS nécessaires

### **Cible d'Injection :**
- **Formulaire** : `PKP\components\forms\publication\TitleAbstractForm` (étape "Details" du wizard de soumission)
- **Position** : Après le champ résumé (abstract) existant
- **Condition** : Vérification du statut premium de l'utilisateur

## 🌐 API Endpoint Personnalisé

### **Endpoint Principal :**
- **URL** : `/api/v1/contexts/{contextId}/ai-analysis`
- **Méthode** : `POST`
- **Authentification** : Requise (utilisateur connecté)

### **Données Attendues :**
```json
{
  "abstract": "string",           // Résumé à analyser
  "language": "string",           // Langue du résumé (fr, en, etc.)
  "analysisType": "string"        // Type d'analyse (quality, structure, etc.)
}
```

### **Réponse API :**
```json
{
  "success": true,
  "data": {
    "statistics": {
      "wordCount": 150,
      "characterCount": 850
    },
    "suggestions": [
      "Considérez ajouter plus de détails méthodologiques",
      "Évitez l'utilisation de la première personne"
    ],
    "qualityScore": 8.5,
    "improvementAreas": ["methodology", "clarity"]
  }
}
```

### **Vérification Premium :**
- **Endpoint** : `/api/v1/contexts/{contextId}/user-premium-status`
- **Méthode** : `GET`
- **Retour** : Statut premium de l'utilisateur actuel

## 💻 Logique JavaScript Frontend

### **Architecture :**
1. **Détection du Formulaire** : Écoute des événements de rendu des composants de formulaire
2. **Vérification Premium** : Appel API pour vérifier le statut premium de l'utilisateur
3. **Injection Conditionnelle** : Affichage du bouton IA uniquement pour les utilisateurs premium
4. **Gestion des Événements** : Capture du clic sur le bouton et lancement de l'analyse

### **Fonctionnalités Clés :**
- **Injection Dynamique** : Le bouton IA est injecté après le champ résumé
- **Analyse en Temps Réel** : Envoi du résumé à l'API Santaane pour analyse
- **Affichage des Résultats** : Présentation des suggestions d'amélioration
- **Gestion des États** : Loading, succès, erreur avec feedback visuel

### **Sécurité :**
- **Vérification Premium** : Contrôle côté serveur et client
- **Validation des Données** : Sanitisation des entrées utilisateur
- **Gestion des Erreurs** : Messages d'erreur appropriés pour les utilisateurs non-premium

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
- ✅ Analyse IA fonctionnelle avec l'API Santaane
- ✅ Interface utilisateur intuitive et responsive
- ✅ Gestion appropriée des erreurs et états de chargement
