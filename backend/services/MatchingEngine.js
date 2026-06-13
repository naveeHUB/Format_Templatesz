const fs = require('fs');
const path = require('path');
const stringSimilarity = require('string-similarity');

class MatchingEngine {
    constructor() {
        this.synonymsFile = path.join(__dirname, '../data/synonyms.json');
        this.loadSynonyms();
    }
    
    loadSynonyms() {
        if (fs.existsSync(this.synonymsFile)) {
            this.synonyms = JSON.parse(fs.readFileSync(this.synonymsFile, 'utf8'));
        } else {
            this.synonyms = {
                "customer name": ["customer", "cust", "client", "client name", "cust name"],
                "part number": ["part no", "part code", "material", "sku", "item code"],
                "quantity": ["qty", "qt", "count", "volume"],
                "amount": ["value", "total", "price", "sum"],
                "date": ["date", "transaction date", "order date", "created date"],
                "shipment date": ["ship date", "dispatch date", "delivery date"],
                "product name": ["product", "item", "description", "product description"]
            };
            this.saveSynonyms();
        }
    }
    
    saveSynonyms() {
        fs.writeFileSync(this.synonymsFile, JSON.stringify(this.synonyms, null, 2));
    }
    
    calculateMatchScore(sourceHeaders, templateHeaders) {
        const matches = [];
        
        for (const sourceHeader of sourceHeaders) {
            let bestMatch = null;
            let bestScore = 0;
            
            for (const templateHeader of templateHeaders) {
                const score = this.calculateSimilarity(sourceHeader, templateHeader);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = templateHeader;
                }
            }
            
            matches.push({
                sourceHeader: sourceHeader,
                templateField: bestMatch,
                score: Math.round(bestScore),
                confidence: this.getConfidenceLevel(bestScore)
            });
        }
        
        const overallScore = matches.reduce((sum, m) => sum + m.score, 0) / matches.length;
        
        return {
            matches: matches,
            overallScore: Math.round(overallScore),
            confidence: this.getConfidenceLevel(overallScore)
        };
    }
    
    calculateSimilarity(source, target) {
        if (!source || !target) return 0;
        
        const sourceNorm = source.toLowerCase().trim();
        const targetNorm = target.toLowerCase().trim();
        
        // Exact match
        if (sourceNorm === targetNorm) return 100;
        
        // Case-insensitive match
        if (sourceNorm === targetNorm) return 95;
        
        // Synonym match
        const synonymScore = this.checkSynonymMatch(sourceNorm, targetNorm);
        if (synonymScore > 0) return synonymScore;
        
        // Fuzzy match using string-similarity
        const fuzzyScore = stringSimilarity.compareTwoStrings(sourceNorm, targetNorm) * 100;
        if (fuzzyScore > 60) return fuzzyScore;
        
        // Partial match
        if (targetNorm.includes(sourceNorm) || sourceNorm.includes(targetNorm)) {
            return 70;
        }
        
        return 0;
    }
    
    checkSynonymMatch(source, target) {
        for (const [standard, synonyms] of Object.entries(this.synonyms)) {
            const allTerms = [standard, ...synonyms];
            
            const sourceMatch = allTerms.some(term => term === source);
            const targetMatch = allTerms.some(term => term === target);
            
            if (sourceMatch && targetMatch) return 90;
            if (sourceMatch || targetMatch) return 70;
        }
        return 0;
    }
    
    getConfidenceLevel(score) {
        if (score >= 90) return 'high';
        if (score >= 70) return 'medium';
        return 'low';
    }
    
    findBestTemplate(sourceHeaders, templates) {
        const results = [];
        
        for (const template of templates) {
            const templateHeaders = template.sheets.flatMap(s => s.headers.map(h => h.header));
            const matchResult = this.calculateMatchScore(sourceHeaders, templateHeaders);
            
            results.push({
                templateId: template.templateId,
                templateName: template.templateName,
                score: matchResult.overallScore,
                confidence: matchResult.confidence,
                matches: matchResult.matches
            });
        }
        
        results.sort((a, b) => b.score - a.score);
        
        return {
            bestMatch: results[0] || null,
            alternatives: results.slice(1, 4),
            allMatches: results
        };
    }
    
    addSynonym(standardTerm, synonym) {
        if (!this.synonyms[standardTerm]) {
            this.synonyms[standardTerm] = [];
        }
        if (!this.synonyms[standardTerm].includes(synonym)) {
            this.synonyms[standardTerm].push(synonym);
            this.saveSynonyms();
        }
    }
}

module.exports = new MatchingEngine();