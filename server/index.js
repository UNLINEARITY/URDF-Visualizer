const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors({ origin: 'http://localhost:5173' }));

// Recursive file search
function getFiles(dir, allFiles = []) {
  try {
    if (!fs.existsSync(dir)) return allFiles;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const name = path.join(dir, file);
      const stat = fs.statSync(name);
      if (stat.isDirectory()) {
        getFiles(name, allFiles);
      } else {
        if (file.endsWith('.urdf') || file.endsWith('.xacro')) {
          const publicPath = path.resolve(__dirname, '..', 'public');
          allFiles.push(path.relative(publicPath, name).replace(/\\/g, '/'));
        }
      }
    });
  } catch (err) {}
  return allFiles;
}

// 递归处理 Xacro 包含
function processIncludes(content, workingDir, publicDirPath) {
    // 匹配 <xacro:include filename="" /> 或 <xacro:include filename="$(find ...)" />
    const includeRegex = /<xacro:include\s+filename=\"([^\"]+)\"\s*\/>/g;
    
    return content.replace(includeRegex, (match, filename) => {
        let filePath = filename;
        // 处理 $(find pkg)
        if (filename.includes('$(find ')) {
            const pkgMatch = filename.match(/\$\(find\s+([^)]+)\)/);
            if (pkgMatch) {
                const pkgName = pkgMatch[1];
                const rest = filename.split(')').pop();
                filePath = path.join(publicDirPath, pkgName, rest);
            }
        } else {
            filePath = path.resolve(workingDir, filename);
        }

        if (fs.existsSync(filePath)) {
            console.log(`[Xacro-Pre] Including: ${filePath}`);
            const includeContent = fs.readFileSync(filePath, 'utf8');
            // 移除子文件的 xml header 和 robot 标签，只保留内容
            const stripped = includeContent
                .replace(/<\?xml.*\?>/g, '')
                .replace(/<robot.*?>/g, '')
                .replace(/<\/robot>/g, '');
            // 递归处理嵌套包含
            return processIncludes(stripped, path.dirname(filePath), publicDirPath);
        }
        else {
            console.error(`[Xacro-Pre] Not found: ${filePath}`);
            return `<!-- File not found: ${filename} -->`;
        }
    });
}

app.get('/api/samples', (req, res) => {
  const publicDirPath = path.resolve(__dirname, '..', 'public');
  res.json(getFiles(publicDirPath));
});

app.use('/api/assets', express.static(path.resolve(__dirname, '..', 'public')));

app.get('/api/xacro-to-urdf', async (req, res) => {
  const fileRelativePath = req.query.file;
  if (!fileRelativePath) return res.status(400).send('No file specified');

  const publicDirPath = path.resolve(__dirname, '..', 'public');
  const fullPath = path.resolve(publicDirPath, fileRelativePath);

  if (!fs.existsSync(fullPath)) {
      return res.status(404).send(`File not found: ${fileRelativePath}`);
  }

  try {
    console.log(`[Xacro-Pre] Pre-assembling: ${fullPath}`);
    const content = fs.readFileSync(fullPath, 'utf8');
    const assembled = processIncludes(content, path.dirname(fullPath), publicDirPath);
    
    res.set('Content-Type', 'text/plain'); // 先传回拼装后的 Xacro 字符串
    res.send(assembled);
  } catch (err) {
    console.error('[Xacro] Backend Error:', err);
    res.status(500).send(err.message);
  }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
