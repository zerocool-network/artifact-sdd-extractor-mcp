#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';

function getClaudeConfigPath() {
  const platform = os.platform();
  const home = os.homedir();

  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'Claude', 'claude_desktop_config.json');
  } else {
    return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  }
}

function install() {
  const configPath = getClaudeConfigPath();
  const configDir = path.dirname(configPath);
  const projectRoot = path.resolve(process.cwd());
  const entrypoint = path.join(projectRoot, 'dist', 'index.js');
  const exportDir = path.join(projectRoot, 'exports');

  console.log('🚀 Instalando artifact-sdd-extractor-mcp en Claude Desktop...');
  console.log(`📁 Ruta de configuración: ${configPath}`);
  console.log(`📦 Ejecutable MCP: ${entrypoint}`);

  if (!fs.existsSync(entrypoint)) {
    console.error('❌ Error: dist/index.js no existe. Por favor ejecuta primero: npm run build');
    process.exit(1);
  }

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let config = { mcpServers: {} };
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(content);
      if (!config.mcpServers) {
        config.mcpServers = {};
      }
    } catch (err) {
      console.error('⚠️ Advertencia: No se pudo parsear el archivo existente, creando respaldo...');
      fs.copyFileSync(configPath, `${configPath}.bak-${Date.now()}`);
      config = { mcpServers: {} };
    }
  }

  // Backup existing config
  if (fs.existsSync(configPath)) {
    fs.copyFileSync(configPath, `${configPath}.backup`);
  }

  // Add or update artifact-sdd-extractor
  config.mcpServers['artifact-sdd-extractor'] = {
    command: 'node',
    args: [entrypoint],
    env: {
      EXPORT_DIR: exportDir,
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  console.log('\n✅ ¡Instalación completada con éxito!');
  console.log('✨ Servidor "artifact-sdd-extractor" registrado en Claude Desktop.');
  console.log(`📂 Carpeta de exportación configurada en: ${exportDir}`);
  console.log('\n⚠️ Recuerda reiniciar Claude Desktop completamente (Cmd+Q / Alt+F4) para que cargue el nuevo servidor.');
}

install();
