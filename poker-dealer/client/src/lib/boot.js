// Boot data the server embeds in the HTML shell (see views/app.ejs).
function readBoot() {
  try {
    return JSON.parse(document.getElementById('mmp-boot').textContent);
  } catch {
    return { page: 'login' };
  }
}

export const boot = readBoot();
