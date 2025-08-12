type Tab = { id: string; name: string; selected?: boolean };

const tabsHeader = (tabs: Tab[]): { html: string; script: string } => {
    const html = `<nav role="tablist" aria-label="View" class="flex gap-1" data-flame-header-tabs>
  ${tabs
      .map((t) => {
          const sel = t.selected ? "true" : "false";
          const cls = t.selected ? "bg-gray-200 dark:bg-gray-700" : "bg-gray-100 dark:bg-gray-800";
          return `<button type="button" role="tab" data-flame-tab="${t.id}" aria-selected="${sel}" class="px-2 py-1 rounded text-xs cursor-pointer ${cls}">${t.name}</button>`;
      })
      .join("")}
</nav>`;

    const script = `
(window.subscribeToDOMContentLoaded || function (fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); })(function(){
  function selectHeaderTab(tab){
    try {
      var nav = document.querySelector('[data-flame-header-tabs]');
      if (!nav) return;

      var buttons = nav.querySelectorAll('[role="tab"][data-flame-tab]');
      for (var i=0; i<buttons.length; i++) {
        var b = buttons[i];
        var id = b.getAttribute('data-flame-tab');
        var selected = id === tab;
        b.setAttribute('aria-selected', String(selected));
        b.classList.toggle('bg-gray-200', selected);
        b.classList.toggle('bg-gray-100', !selected);
        b.classList.toggle('dark:bg-gray-700', selected);
        b.classList.toggle('dark:bg-gray-800', !selected);
        var panel = document.getElementById('flame-section-' + id);
        if (panel) panel.classList.toggle('hidden', !selected);
      }
    } catch(_){}
  }

  try {
    var nav = document.querySelector('[data-flame-header-tabs]');
    if (!nav) return;

    var initialBtn = nav.querySelector('[role="tab"][data-flame-tab][aria-selected="true"]') || nav.querySelector('[role="tab"][data-flame-tab]');
    var initial = initialBtn ? initialBtn.getAttribute('data-flame-tab') : null;
    if (initial) selectHeaderTab(initial);

    var btns = nav.querySelectorAll('[role="tab"][data-flame-tab]');
    for (var j=0; j<btns.length; j++) {
      (function(el){
        el.addEventListener('click', function(e){
          e.stopPropagation();
          var id = el.getAttribute('data-flame-tab');
          if (id) selectHeaderTab(id);
        });
      })(btns[j]);
    }
  } catch(_){}
});
`;

    return { html, script };
};

export type { Tab };
export default tabsHeader;
