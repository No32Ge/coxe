// ==========================================
// ⚡ 强健的 PITCH/PATCH 引擎系统
// ==========================================
window.Patcher = {
    parseXmlActions: function(xmlStr) {
        // 使用字符串拼接动态构建正则，阻止被上级 XML 解析器错误捕捉
        const fileTagRegex = new RegExp('<' + 'file\\s+([^>]*?)>([\\s\\S]*?)<' + '/file>', 'g');
        let match;
        const operations = [];
        
        while ((match = fileTagRegex.exec(xmlStr)) !== null) {
            const attrString = match[1];
            const content = match[2];
            
            const nameMatch = attrString.match(/name\s*=\s*["']([^"']+)["']/);
            const actionMatch = attrString.match(/action\s*=\s*["']([^"']+)["']/);
            const toMatch = attrString.match(/to\s*=\s*["']([^"']+)["']/);
            
            const name = nameMatch ? nameMatch[1] : null;
            const action = actionMatch ? actionMatch[1].toLowerCase() : "create";
            const to = toMatch ? toMatch[1] : null;
            
            if (name) {
                operations.push({ action, name, content, to });
            }
        }
        return operations;
    },

    executePitchEngine: function(originalText, patchText) {
        const normOrig = originalText.replace(/\r\n/g, '\n');
        const normPatch = patchText.replace(/\r\n/g, '\n');

        const searchBlockRegex = /<<<<<<<[ \t]*SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n?>>>>>>>[ \t]*REPLACE/g;
        let match;
        let currentContent = normOrig;
        let totalBlocks = 0;
        let succBlocks = 0;
        let failBlocks = [];

        while ((match = searchBlockRegex.exec(normPatch)) !== null) {
            totalBlocks++;
            const searchStr = match[1];
            const replaceStr = match[2];

            if (currentContent.includes(searchStr)) {
                currentContent = currentContent.replace(searchStr, replaceStr);
                succBlocks++;
                continue;
            }

            const origLines = currentContent.split('\n');
            const searchLines = searchStr.split('\n');
            
            const trimOrig = origLines.map(line => line.trimEnd());
            const trimSearch = searchLines.map(line => line.trimEnd());

            let matchIndex = -1;
            for (let i = 0; i <= trimOrig.length - trimSearch.length; i++) {
                let matchAll = true;
                for (let j = 0; j < trimSearch.length; j++) {
                    if (trimOrig[i + j] !== trimSearch[j]) {
                        matchAll = false;
                        break;
                    }
                }
                if (matchAll) {
                    matchIndex = i;
                    break;
                }
            }

            if (matchIndex !== -1) {
                const beforeLines = origLines.slice(0, matchIndex);
                const afterLines = origLines.slice(matchIndex + searchLines.length);
                const replaceLines = replaceStr.split('\n');
                currentContent = [...beforeLines, ...replaceLines, ...afterLines].join('\n');
                succBlocks++;
            } else {
                failBlocks.push(searchStr);
            }
        }

        if (totalBlocks === 0) {
            return {
                content: patchText,
                success: true,
                msg: "未识别到 SEARCH/REPLACE 格式块。已自动使用全文覆盖覆盖该文件。"
            };
        }

        return {
            content: currentContent,
            success: failBlocks.length === 0,
            msg: `应用了 ${succBlocks}/${totalBlocks} 个修补块。` + 
                 (failBlocks.length > 0 ? ` [${failBlocks.length} 个修补块由于原代码匹配缺失而失败。]` : "")
        };
    }
};