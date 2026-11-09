(() => {
  const menu = document.querySelector('#menu');
  const nav = document.querySelector('#nav');
  function closeMenu() { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }
  menu.addEventListener('click', () => menu.setAttribute('aria-expanded', String(nav.classList.toggle('open'))));
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); menu.focus(); } });
  document.addEventListener('click', event => { if (!event.target.closest('header')) closeMenu(); });
  document.querySelector('#year').textContent = new Date().getFullYear();

  // Manual controls and arrow-key navigation share the same selected state.
  function setupTabs(selector, onSelect = () => {}) {
    const list = document.querySelector(selector);
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    let current = 0;
    function select(index, focus = false) {
      current = Math.max(0, Math.min(tabs.length - 1, index));
      tabs.forEach((tab, i) => {
        const active = i === current;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
      });
      onSelect(current);
      if (focus) tabs[current].focus({ preventScroll: true });
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(index));
      tab.addEventListener('keydown', event => {
        let next;
        if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (current + 1) % tabs.length;
        if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (current - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next !== undefined) { event.preventDefault(); select(next, true); }
      });
    });
    select(0);
    return { select, get current() { return current; } };
  }
  setupTabs('.stage-tabs');
  const previous = document.querySelector('#journey-prev');
  const next = document.querySelector('#journey-next');
  const journey = setupTabs('.journey-tabs', index => {
    document.querySelector('.journey-track span').style.width = `${(index + 1) * 25}%`;
    document.querySelector('#journey-position').textContent = `Etapa ${index + 1} de 4`;
    previous.disabled = index === 0;
    next.disabled = index === 3;
  });
  previous.addEventListener('click', () => journey.select(journey.current - 1));
  next.addEventListener('click', () => journey.select(journey.current + 1));

  const topics = {
    formacao: {"context": "Vamos pensar em um encontro para o seu público.", "intro": "Gostaria de solicitar uma proposta de formação.", "options": ["Um treinamento para minha equipe", "Um curso para aprofundar conhecimentos", "Uma palestra para um evento"]},
    treinamentos: {"context": "Vamos conversar sobre o que sua equipe precisa desenvolver.", "intro": "Gostaria de contratar um treinamento para minha equipe.", "options": ["Capacitação sobre regularização e INSS de obras", "Capacitação em rotinas contábeis, fiscais ou trabalhistas", "Alinhar um tema conforme a necessidade da equipe"]},
    cursos: {"context": "Vamos entender seu interesse e conversar sobre as possibilidades de curso.", "intro": "Tenho interesse nos seus cursos.", "options": ["Conhecer as possibilidades de cursos", "Solicitar um curso para um grupo de profissionais", "Conversar sobre conteúdo e formato"]},
    palestras: {"context": "Conte-me sobre o evento, o público e o objetivo do encontro.", "intro": "Gostaria de contratar uma palestra.", "options": ["Uma palestra para um evento profissional", "Uma palestra para minha equipe", "Definir um tema para o encontro"]},
    planejamento: { context: 'Você está planejando começar uma obra.', intro: 'Estou planejando começar uma obra.', options: ['Entender como a consultoria pode me ajudar', 'Conversar sobre acompanhamento desde o início', 'Esclarecer uma dúvida sobre a minha obra'] },
    andamento: { context: 'Sua obra está em andamento.', intro: 'Minha obra está em andamento.', options: ['Conhecer o acompanhamento durante a obra', 'Conversar sobre documentos e pendências', 'Entender a análise dos valores e créditos de INSS'] },
    concluida: { context: 'Sua obra já terminou.', intro: 'Minha obra já terminou.', options: ['Conversar sobre a regularização da obra', 'Entender os valores do INSS', 'Pedir apoio para avaliar as pendências'] },
    equipe: { context: 'Você procura apoio para sua equipe.', intro: 'Procuro apoio para a minha equipe.', options: ['Conhecer a consultoria para a equipe contábil', 'Conversar sobre uma palestra ou capacitação', 'Esclarecer uma dúvida sobre a rotina de uma obra'] }
  };
  const dialog = document.querySelector('#conversation-dialog');
  const form = document.querySelector('#conversation-form');
  const formView = document.querySelector('#conversation-form-view');
  const preview = document.querySelector('#conversation-preview');
  const detail = document.querySelector('#conversation-detail');
  const send = document.querySelector('#conversation-send');
  let selectedTopic = 'planejamento';
  let opener;
  document.querySelectorAll('[data-conversation]').forEach(button => button.addEventListener('click', () => {
    selectedTopic = button.dataset.conversation;
    const topic = topics[selectedTopic];
    opener = button;
    form.reset();
    send.removeAttribute('href');
    formView.hidden = false;
    preview.hidden = true;
    dialog.setAttribute('aria-labelledby', 'conversation-title');
    document.querySelector('#conversation-context').textContent = topic.context;
    const options = document.querySelector('#conversation-options');
    options.replaceChildren();
    topic.options.forEach((label, index) => {
      const item = document.createElement('label');
      item.className = 'conversation-option';
      const input = document.createElement('input');
      input.type = 'radio'; input.name = 'subject'; input.value = String(index); input.required = true;
      const text = document.createElement('span'); text.textContent = label;
      item.append(input, text); options.append(item);
    });
    dialog.showModal();
    document.body.classList.add('dialog-open');
    document.querySelector('#conversation-close').focus();
  }));
  function closeConversation() { dialog.close(); }
  document.querySelector('#conversation-close').addEventListener('click', closeConversation);
  dialog.addEventListener('close', () => { document.body.classList.remove('dialog-open'); opener?.focus({ preventScroll: true }); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeConversation();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const topic = topics[selectedTopic];
    const selected = form.querySelector('[name="subject"]:checked');
    if (!selected) return;
    const lines = ['Olá, Edilene! Gostaria de conversar com você.', '', topic.intro, `Meu interesse é: ${topic.options[Number(selected.value)].replace(/^./, first => first.toLocaleLowerCase('pt-BR'))}.`];
    if (detail.value.trim()) lines.push('', detail.value.trim());
    const message = lines.join('\n');
    document.querySelector('#conversation-message').textContent = message;
    send.href = `https://wa.me/5511926660609?text=${encodeURIComponent(message)}`;
    formView.hidden = true; preview.hidden = false;
    dialog.setAttribute('aria-labelledby', 'conversation-preview-title');
    document.querySelector('#conversation-preview-title').focus();
  });
  document.querySelector('#conversation-back').addEventListener('click', () => {
    preview.hidden = true; formView.hidden = false; send.removeAttribute('href');
    dialog.setAttribute('aria-labelledby', 'conversation-title');
    detail.focus();
  });
})();
