const Database = require('../database/database');

class MatchingEngineService {
    async findBestMatch(sourceHeaders, templateId = null) {
        let templates = await Database.getTemplates();
        
        if (templateId) {
            templates = templates.filter(t => t.id === parseInt(templateId) && t.is_active !== false);
        } else {
            templates = templates.filter(t => t.is_active !== false);
        }
        
        const matches = [];
        
        for (const template of templates) {
            const templateHeaders = template.discoveredHeaders || [];
            const score = await this.calculateMatchScore(sourceHeaders, templateHeaders);
            
            matches.push({
                templateId: template.id,
                templateName: template.name,
                category: template.category,
                version: template.version,
                matchPercentage: score.percentage,
                matchedHeaders: score.matchedHeaders,
                unmatchedSourceHeaders: score.unmatchedSource,
                unmatchedTemplateHeaders: score.unmatchedTemplate
            });
        }
        
        matches.sort((a, b) => b.matchPercentage - a.matchPercentage);
        
        return {
            bestMatch: matches[0] || null,
            alternatives: matches.slice(1, 5),
            allMatches: matches
        };
    }
    
    async calculateMatchScore(sourceHeaders, templateHeaders) {
        let matched = 0;
        let partialMatched = 0;
        const matchedHeaders = [];
        const unmatchedSource = [];
        const unmatchedTemplate = [...templateHeaders];
        
        for (const sourceHeader of sourceHeaders) {
            let found = false;
            let bestMatch = null;
            let bestScore = 0;
            
            for (const templateHeader of templateHeaders) {
                const similarity = await this.calculateSimilarity(sourceHeader, templateHeader);
                
                if (similarity === 1) {
                    matched++;
                    matchedHeaders.push({ source: sourceHeader, target: templateHeader, confidence: 1 });
                    this.removeFromArray(unmatchedTemplate, templateHeader);
                    found = true;
                    break;
                } else if (similarity > 0.7 && similarity > bestScore) {
                    bestScore = similarity;
                    bestMatch = templateHeader;
                }
            }
            
            if (!found && bestMatch) {
                partialMatched++;
                matchedHeaders.push({ source: sourceHeader, target: bestMatch, confidence: bestScore });
                this.removeFromArray(unmatchedTemplate, bestMatch);
            } else if (!found) {
                unmatchedSource.push(sourceHeader);
            }
        }
        
        const totalHeaders = Math.max(sourceHeaders.length, templateHeaders.length);
        const percentage = totalHeaders > 0 ? ((matched + partialMatched * 0.5) / totalHeaders) * 100 : 0;
        
        return {
            percentage: Math.round(percentage),
            matchedHeaders: matchedHeaders,
            unmatchedSource: unmatchedSource,
            unmatchedTemplate: unmatchedTemplate
        };
    }
    
    async calculateSimilarity(source, target) {
        if (!source || !target) return 0;
        
        if (source.toLowerCase() === target.toLowerCase()) {
            return 1;
        }
        
        // Check synonyms
        const synonyms = await Database.getSynonyms();
        for (const [standard, synList] of Object.entries(synonyms)) {
            if (standard.toLowerCase() === target.toLowerCase() || 
                synList.some(s => s.toLowerCase() === target.toLowerCase())) {
                if (source.toLowerCase() === standard.toLowerCase() ||
                    synList.some(s => s.toLowerCase() === source.toLowerCase())) {
                    return 0.95;
                }
            }
        }
        
        // Fuzzy matching
        const normalizedSource = this.normalizeText(source);
        const normalizedTarget = this.normalizeText(target);
        
        if (normalizedSource === normalizedTarget) {
            return 0.9;
        }
        
        // Contains matching
        if (normalizedTarget.includes(normalizedSource) || normalizedSource.includes(normalizedTarget)) {
            return 0.7;
        }
        
        // Calculate Levenshtein distance
        const distance = this.levenshteinDistance(normalizedSource, normalizedTarget);
        const maxLength = Math.max(normalizedSource.length, normalizedTarget.length);
        const similarity = maxLength > 0 ? 1 - (distance / maxLength) : 0;
        
        return similarity > 0.5 ? similarity : 0;
    }
    
    normalizeText(text) {
        if (!text) return '';
        return text.toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .replace(/\s+/g, '');
    }
    
    levenshteinDistance(str1, str2) {
        const track = Array(str2.length + 1).fill(null).map(() =>
            Array(str1.length + 1).fill(null));
        
        for (let i = 0; i <= str1.length; i++) track[0][i] = i;
        for (let j = 0; j <= str2.length; j++) track[j][0] = j;
        
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                track[j][i] = Math.min(
                    track[j][i - 1] + 1,
                    track[j - 1][i] + 1,
                    track[j - 1][i - 1] + indicator
                );
            }
        }
        
        return track[str2.length][str1.length];
    }
    
    removeFromArray(array, item) {
        const index = array.indexOf(item);
        if (index > -1) array.splice(index, 1);
    }
}

module.exports = new MatchingEngineService();