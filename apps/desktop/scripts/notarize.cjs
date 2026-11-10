// Notarização da Apple, só quando o CI tiver as credenciais de Desenvolvedor Apple:
// APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD e APPLE_TEAM_ID (e o certificado em CSC_LINK/CSC_KEY_PASSWORD).
// Sem elas, o app sai com assinatura ad-hoc e este passo não faz nada.
exports.default = async function notarize(context) {
  if (context.electronPlatformName !== 'darwin') return
  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) { console.log('notarização: sem credenciais da Apple, pulando'); return }
  const { notarize } = require('@electron/notarize')
  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`
  console.log('notarização: enviando', appPath)
  await notarize({ appPath, appleId: APPLE_ID, appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD, teamId: APPLE_TEAM_ID })
}
