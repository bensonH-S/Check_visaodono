/**
 * Proxy do Playwright para BK Office (Bright Data BR ou BKOFFICE_PROXY legado).
 * Senha nunca em log / nunca hardcoded.
 */

const BRIGHTDATA_SERVER_DEFAULT = 'http://brd.superproxy.io:44445';
const BRIGHTDATA_USER_DEFAULT =
  'brd-customer-hl_c5f6474c-zone-bkoffice_br-country-br';

/**
 * @returns {{ server: string, username?: string, password?: string, provider: 'brightdata'|'legacy' }|null}
 */
export function resolveBkOfficePlaywrightProxy() {
  // Kit PC / Chrome BR: BKOFFICE_BRIGHTDATA=0 desliga o proxy mesmo com senha no .env
  const brightOff =
    process.env.BKOFFICE_BRIGHTDATA === '0' ||
    process.env.BKOFFICE_BRIGHTDATA === 'false';
  if (brightOff) return null;

  const brightPass = String(process.env.BRIGHTDATA_PROXY_PASSWORD || '').trim();
  const brightForced =
    process.env.BKOFFICE_BRIGHTDATA === '1' ||
    process.env.BKOFFICE_BRIGHTDATA === 'true' ||
    Boolean(brightPass);

  if (brightForced) {
    if (!brightPass) {
      throw Object.assign(
        new Error(
          'Bright Data ativo, mas BRIGHTDATA_PROXY_PASSWORD não está definida. ' +
            'Coloque a senha da zona no .env (nunca no código).',
        ),
        { status: 503, code: 'BRIGHTDATA_PASSWORD_MISSING' },
      );
    }
    const server = String(
      process.env.BRIGHTDATA_PROXY_SERVER ||
        process.env.BKOFFICE_PROXY ||
        BRIGHTDATA_SERVER_DEFAULT,
    )
      .trim()
      .replace(/\/$/, '');
    const username = String(
      process.env.BRIGHTDATA_PROXY_USER ||
        process.env.BKOFFICE_PROXY_USER ||
        BRIGHTDATA_USER_DEFAULT,
    ).trim();
    return {
      server: server.includes('://') ? server : `http://${server}`,
      username,
      password: brightPass,
      provider: 'brightdata',
    };
  }

  const proxyRaw = String(process.env.BKOFFICE_PROXY || process.env.HTTPS_PROXY || '').trim();
  if (!proxyRaw) return null;

  let server = proxyRaw;
  let username = String(process.env.BKOFFICE_PROXY_USER || '').trim() || undefined;
  let password =
    String(process.env.BKOFFICE_PROXY_PASS || process.env.BRIGHTDATA_PROXY_PASSWORD || '').trim() ||
    undefined;
  try {
    const u = new URL(proxyRaw.includes('://') ? proxyRaw : `http://${proxyRaw}`);
    server = `${u.protocol}//${u.host}`;
    if (u.username) username = decodeURIComponent(u.username);
    if (u.password) password = decodeURIComponent(u.password);
  } catch {
    /* mantém server cru */
  }

  return {
    server,
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
    provider: 'legacy',
  };
}

/** Log seguro (sem senha). */
export function logProxyBkOffice(proxy) {
  if (!proxy) {
    console.log('[bkoffice] Playwright sem proxy (acesso direto)');
    return;
  }
  const userHint = proxy.username ? ` user=${proxy.username.slice(0, 12)}…` : '';
  console.log(`[bkoffice] Playwright proxy ${proxy.provider} → ${proxy.server}${userHint}`);
}
