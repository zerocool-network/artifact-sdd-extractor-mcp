#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline/promises';
import { execSync } from 'child_process';

// ANSI color escape codes for rich terminal styling
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  bgDark: '\x1b[40m',
};

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[0f');
}

function printBanner() {
  console.log(`
${c.cyan}${c.bold}╭────────────────────────────────────────────────────────────────────────╮
│                                                                        │
│   ${c.white}⚙️  ZEROCOOL NETWORK  —  artifact-sdd-extractor-mcp                  ${c.cyan}│
│   ${c.dim}Asistente Interactivo de Configuración para Claude Desktop          ${c.cyan}│
│                                                                        │
╰────────────────────────────────────────────────────────────────────────╯${c.reset}
`);
}

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

async function main() {
  const args = process.argv.slice(2);
  const autoConfirm = args.includes('--yes') || args.includes('-y');

  clearScreen();
  printBanner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const projectRoot = path.resolve(process.cwd());
    const entrypoint = path.join(projectRoot, 'dist', 'index.js');
    const defaultExportDir = path.join(projectRoot, 'exports');
    const configPath = getClaudeConfigPath();
    const configDir = path.dirname(configPath);

    // 1. Diagnóstico de Prerrequisitos
    console.log(`${c.bold}${c.blue}🔍 1. Comprobando Entorno y Prerrequisitos...${c.reset}`);
    console.log(`   ${c.dim}• Sistema Operativo:${c.reset} ${os.type()} (${os.arch()})`);
    console.log(`   ${c.dim}• Directorio del Proyecto:${c.reset} ${projectRoot}`);
    console.log(`   ${c.dim}• Archivo de Claude Desktop:${c.reset} ${configPath}`);

    // Verificar si el proyecto está compilado
    if (!fs.existsSync(entrypoint)) {
      console.log(`\n   ${c.yellow}⚠️  El ejecutable dist/index.js no existe. Compilando TypeScript...${c.reset}`);
      try {
        execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });
        console.log(`   ${c.green}✔ Proyecto compilado con éxito.${c.reset}`);
      } catch (err) {
        console.error(`\n${c.red}❌ Error al compilar TypeScript. Por favor ejecuta 'npm run build' manualmente.${c.reset}`);
        process.exit(1);
      }
    } else {
      console.log(`   ${c.green}✔ Ejecutable compilado encontrado:${c.reset} dist/index.js`);
    }

    console.log('');

    // 2. Formulario de Parámetros de Configuración
    console.log(`${c.bold}${c.blue}📋 2. Parámetros de Configuración${c.reset}`);
    console.log(`   ${c.dim}Pulsa Enter para aceptar los valores por defecto sugeridos.${c.reset}\n`);

    // Pregunta A: Nombre del servidor en Claude Desktop
    let serverName = 'artifact-sdd-extractor';
    if (!autoConfirm) {
      const inputName = await rl.question(
        `   ${c.bold}Nombre del servidor en Claude Desktop${c.reset} ${c.dim}[${serverName}]:${c.reset} `
      );
      if (inputName.trim()) serverName = inputName.trim();
    }

    // Pregunta B: Directorio de Exportación
    let exportDir = defaultExportDir;
    if (!autoConfirm) {
      const inputExport = await rl.question(
        `   ${c.bold}Directorio de exportación de SDDs${c.reset} ${c.dim}[${exportDir}]:${c.reset} `
      );
      if (inputExport.trim()) exportDir = path.resolve(inputExport.trim());
    }

    // Asegurar que exista el directorio de exportación
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Pregunta C: Nivel de logs
    let logLevel = 'info';
    if (!autoConfirm) {
      const inputLog = await rl.question(
        `   ${c.bold}Nivel de log (info / debug / warn)${c.reset} ${c.dim}[${logLevel}]:${c.reset} `
      );
      if (['info', 'debug', 'warn'].includes(inputLog.trim().toLowerCase())) {
        logLevel = inputLog.trim().toLowerCase();
      }
    }

    console.log('\n');

    // 3. Inspección del archivo de Claude Desktop existente
    console.log(`${c.bold}${c.blue}🔍 3. Verificando Configuración de Claude Desktop...${c.reset}`);
    let existingConfig = { mcpServers: {} };
    let alreadyInstalled = false;

    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        existingConfig = JSON.parse(raw);
        if (!existingConfig.mcpServers) existingConfig.mcpServers = {};
        if (existingConfig.mcpServers[serverName]) alreadyInstalled = true;

        const currentServers = Object.keys(existingConfig.mcpServers);
        console.log(`   ${c.dim}• Servidores MCP actualmente registrados (${currentServers.length}):${c.reset}`);
        for (const sName of currentServers) {
          const isTarget = sName === serverName;
          console.log(`     ${isTarget ? c.yellow + '➔' : c.dim + '•'} ${sName}${isTarget ? ' (será actualizado)' : ''}${c.reset}`);
        }
      } catch {
        console.log(`   ${c.yellow}⚠️  El archivo de configuración actual se respaldará antes de modificar.${c.reset}`);
      }
    } else {
      console.log(`   ${c.dim}• No existe configuración previa de Claude Desktop. Se creará una nueva.${c.reset}`);
    }

    console.log('\n');

    // 4. Previsualización de los cambios
    const newEntry = {
      command: 'node',
      args: [entrypoint],
      env: {
        EXPORT_DIR: exportDir,
        LOG_LEVEL: logLevel,
      },
    };

    console.log(`${c.bold}${c.cyan}╭────────────────────────────────────────────────────────────────────────╮
│  📝 Previsualización del bloque a registrar en Claude Desktop:         │
╰────────────────────────────────────────────────────────────────────────╯${c.reset}`);
    console.log(c.dim + JSON.stringify({ [serverName]: newEntry }, null, 2) + c.reset);
    console.log('');

    // 5. Confirmación interactiva
    if (!autoConfirm) {
      const confirm = await rl.question(
        `   ${c.bold}¿Deseas aplicar esta configuración a Claude Desktop ahora? [S/n]:${c.reset} `
      );
      if (confirm.trim().toLowerCase() === 'n' || confirm.trim().toLowerCase() === 'no') {
        console.log(`\n${c.yellow}⏹️ Operación cancelada por el usuario. No se modificó ningún archivo.${c.reset}\n`);
        rl.close();
        process.exit(0);
      }
    }

    // 6. Aplicación de Cambios con Respaldo
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    if (fs.existsSync(configPath)) {
      const backupPath = `${configPath}.backup`;
      fs.copyFileSync(configPath, backupPath);
      console.log(`\n   ${c.dim}✔ Respaldo de seguridad creado en:${c.reset} ${backupPath}`);
    }

    existingConfig.mcpServers[serverName] = newEntry;
    fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2), 'utf-8');

    // 7. Diagnóstico Final del Servidor
    console.log(`   ${c.green}✔ Configuración escrita con éxito en:${c.reset} ${configPath}`);
    console.log(`   ${c.green}✔ Servidor '${serverName}' registrado en Claude Desktop.${c.reset}`);

    // Test de arranque
    try {
      execSync(`node "${entrypoint}" --help`, { stdio: 'pipe' });
      console.log(`   ${c.green}✔ Health-Check superado: El binario MCP responde correctamente.${c.reset}`);
    } catch (err) {
      console.log(`   ${c.yellow}⚠️ Advertencia al verificar el binario con --help.${c.reset}`);
    }

    console.log(`
${c.green}${c.bold}╭────────────────────────────────────────────────────────────────────────╮
│                                                                        │
│   🎉  ¡CONFIGURACIÓN COMPLETADA CON ÉXITO!                             │
│                                                                        │
│   ${c.white}1. Reinicia Claude Desktop completamente (Cmd+Q en Mac).             ${c.green}│
│   ${c.white}2. Abre Claude y pídele:                                             ${c.green}│
│      ${c.dim}"Genera el SDD completo del artifact que tenemos en pantalla"    ${c.green}│
│                                                                        │
╰────────────────────────────────────────────────────────────────────────╯${c.reset}
`);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`\n${c.red}❌ Error fatal en el asistente:${c.reset}`, err);
  process.exit(1);
});
