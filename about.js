const appIconEl = document.getElementById('about-app-icon');
if (__APP_ICON__) {
  appIconEl.src = __APP_ICON__;
  appIconEl.alt = 'App Icon';
}

document.getElementById('about-version-number').textContent = __APP_VERSION__;

function renderDeps(deps) {
  const container = document.getElementById('about-deps');
  const divider = document.getElementById('deps-divider');

  if (!deps || deps.length === 0) return;

  divider.style.display = 'block';

  const title = document.createElement('div');
  title.className = 'about-deps-title';
  title.textContent = '致谢';
  container.appendChild(title);

  deps.forEach(dep => {
    const item = document.createElement('div');
    item.className = 'about-dep-item';

    const nameEl = document.createElement('span');
    nameEl.className = 'about-dep-name';
    nameEl.textContent = dep.name;

    let linkText = dep.version ? `v${dep.version}` : dep.name;

    const linkEl = document.createElement('a');
    linkEl.className = 'about-dep-link';
    linkEl.href = dep.url;
    linkEl.target = '_blank';
    linkEl.rel = 'noopener noreferrer';
    linkEl.textContent = linkText;

    item.appendChild(nameEl);
    item.appendChild(linkEl);
    container.appendChild(item);
  });
}

renderDeps(__ABOUT_DEPS__);
