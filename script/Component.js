/** {View} @class WebComponentView @extends {HTMLElement} @export @default
  * @property {DocumentImport} template html-шаблон компонента
  * @property {DocumentFragment} content готовое к вставке содержимое компонента
  * @property {string} basepath путь до компонента
  */
 export default class View extends HTMLElement {
  /** Creates an instance of View
   * @param {*} id Элемент страницы
   * @param {string} [mode='open'] тип доступа к элементу из JS
   */
  constructor(id, mode = 'open') {
      super();
      this.shadow = this.attachShadow({mode});
      const data = include(id);
      stylesheet(data);
      this.template = data.template;
    }

  /**
    * @method render вставка содержимого компонента в shadowRoot
    */
    render() {
      if (!this.ownerDocument.defaultView) return; // !
      this.content = this.template.cloneNode(true);
      this.init();
      this.shadow.appendChild(this.content);
      return this;
    }

  /**
    * @method event отправка события во внешний DOM
    */
    event(event, detail = null) {
      const options = {bubbles: true, composed: true};
      event = new CustomEvent(event, {detail, ...options});
      return this.dispatchEvent(event);
    }

    // #region [Behavior] @verride
    /**
      * @method init инициализация содержимого компонента
      */
      init() {
        return this;
      }

    /**
      * @method mount инициализация содержимого компонента (после рендеринга)
      */
      mount() {
        return this;
      }

    /** */
      connectedCallback() {
        // this.ready() // this.init()
        this.render();
        this.mount();
      }

      // static get observedAttributes() { return [...@string]; }
      // attributeChangedCallback(attrName, oldVal, newVal) {}

      // disconnectedCallback() {}

      // adoptedCallback() {}
    // #endregion
  }

// #region [Private]
  /** */
    function include(id) {
      const included = $('#' + id).import;
      return {
        basepath: URL(document.baseURI),
        included: URL(included.URL),
        template: included.getElementsByTagName('template')[0].content
      };
    }

  /** */
    function stylesheet({basepath, included, template}) {
      const sheets = $(['link[rel="stylesheet"]:not([data-absolute]):not([href^="/"])'], template);
      sheets.forEach(link => {
        const href = URL(link.getAttribute('href'));
        const url = absolutePath(basepath, included, href);
        link.href = url;
        link.dataset.absolute = true;
      });
    }

  /**  */
    function absolutePath(rootpath, basepath, relative) {
      const folders = rootpath.folders.every((e, i) => relative.folders[i] === e)
        ? relative.folders.slice(rootpath.folders.length)
        : relative.folders;

      return [
        basepath.protocol + ":/",
        basepath.host,
        basepath.folders.slice(0, basepath.folders.length - relative.parents).concat(folders).join('/'),
        relative.file
      ].join('/');
    }

  /** Разбор url */
    function URL(url) {
      const a = document.createElement('a');
      a.href = url;
      const file = (a.pathname.match(/\/([^/?#]+)$/i) || [undefined, ''])[1];
      const index = file.lastIndexOf('.');
      const hash = a.hash.replace('#', '');
      const folders = a.pathname.replace(/^\//, '').split('/');
      const parents = url.match(/^(\.\.\/)+/g);

      if (folders.length && [file, ''].includes(folders.slice(-1)[0])) folders.pop();

      return {
        source: url,
        protocol: a.protocol.replace(':', ''),
        host: a.hostname,
        port: a.port,
        query: a.search,
        params: fromQuery(a.search),
        file,
        extension: index > -1 ? file.substr(index + 1) : '',
        hash,
        path: a.pathname.replace(/^([^/])/, '/$1'),
        relative: (a.href.match(/tps?:\/\/[^/]+(.+)/) || [undefined, ''])[1],
        folders,
        segment: hash.split('/'),
        parents: parents !== null ? parents[0].split('/').length - 1 : 0,
        neighbor: url.indexOf('./') === 0
      };
    }

  /** Создание объекта из query-строки
    * @param {string} string query-строка (если первый символ '?' - он будет проигнорирован)
    * @param {boolean} decode если передан, данные будут декодированы
    * @return {object} список параметров
    */
    function fromQuery(string, decode = false) {
      const result = {}, segment = string.replace(/^\?/, '').split('&');
      for (let i = 0; i < segment.length; ++i) {
        if (!segment[i]) continue;
        const temp = segment[i].split('=');
        result[temp[0]] = decode ? decodeURIComponent(temp[1]) : temp[1];
      }
      return result;
    }
// #endregion

/** */
  export function $(selector = '*', root = document, deep = false) {
    const all = selector instanceof Array;
    if (all) selector = selector[0];

    let elements = [];

    elements = elements.concat(...root.querySelectorAll(selector));
    if (root.shadowRoot) elements = elements.concat(...root.shadowRoot.querySelectorAll(selector));
    const hasSlotes = root.querySelector('slot') || root.shadowRoot && root.shadowRoot.querySelector('slot') || root instanceof HTMLSlotElement;
    if (hasSlotes) {
      const slotes = root instanceof HTMLSlotElement
        ? [root]
        : [].concat(root.querySelector('slot'), root.shadowRoot ? [...root.shadowRoot.querySelector('slot')] : []);
      const assigned = slotes.reduce((list, slot) => list.concat(...slot.assignedNodes()), []).filter(e => e.querySelectorAll);
      elements = elements.concat(...assigned.map(node => [...node.querySelectorAll(selector)]));
    }

    const links = [...root.querySelectorAll('link')].filter(link => link.import instanceof Document);
    elements = elements.concat(...links.map(link => $([selector], link.import, true)));

    elements = elements.filter(e => e).filter((e, i, l) => l.indexOf(e) === i)

    return all
      ? elements.length
        ? elements
        : []
      : elements.length
        ? elements[0]
        : null;
  }

/** */
  export function $$(selector = '*', root = document) {
    const all = selector instanceof Array;
    if (all) selector = selector[0];

    let element = select(selector, root, all);
    if (empty(element, all) && root.shadowRoot) element = select(selector, element.shadowRoot, all);
    if (empty(element, all) ) {
      const children = [...root.children];
      // debugger;
      for (let index = 0; index < children.length; ++index) {
        const shadow = children[index].shadowRoot;
        if (shadow) element = $(all ? [selector] : selector, shadow);
        if (!empty(element, all)) break;
      }
    }

    if (empty(element, all) && root.shadowRoot) {
      const slotes = [...root.shadowRoot.querySelectorAll('slot')];
      // for
      slotes.forEach(slot => {
        const slotted = slot.assignedNodes();
      });
    }

    if (empty(element, all)) {
      const children = [...root.querySelectorAll('link')]
        .filter(link => link.import instanceof Document);

      for (let index = 0; index < children.length; ++index) {
        const imported = children[index].import;
        element = $$(all ? [selector] : selector, imported);
        if (!empty(element, all)) break;
      }
    }

    return result(element, all);
  }

/** */
  function select(selector = '*', root = document, all = false) {
    return all
      ? root.querySelectorAll(selector)
      : root.querySelector(selector);
  }

/** */
  function empty(element, all) {
    return all
      ? element.length === 0
      : element === null;
  }

/** */
  function result(element, all) {
    return all
      ? empty(element, all)
        ? []
        : [...element]
      : empty(element, all)
        ? null
        : element;
  }


/*
// теоретически, было
get opened() {
    return this.getAttribute("opened") !== null;
}
set opened(value) {
    if (!!value) {
        this.setAttribute("opened", "");
    } else {
        this.removeAttribute("opened");
    }
}
// теоретически, стало
properties = {
    opened: {
        type: Boolean,
    },
}
*/
