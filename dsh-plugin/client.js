window.__ModuleLoader__.load({
  id: 'dsh-plugin-athand',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'athand';
    const PANEL_ID = 'athand-clipboard';
    const STORAGE_KEY = 'dsh.athand.v1';
    const HOST_MIGRATION_KEY = 'dsh.athand.host-migrated.v1';
    // Keys written before the rename. Their contents (cached snapshot, offline
    // queue, one-shot migration flag) are adopted once so nothing is lost.
    const LEGACY_STORAGE_KEYS = {
      [STORAGE_KEY]: 'dsh.bester-copy.v1',
      [HOST_MIGRATION_KEY]: 'dsh.bester-copy.host-migrated.v1',
      'dsh.athand.pending.v1': 'dsh.bester-copy.pending.v1',
    };
    const HOST_API = '/api/athand';
    const DEFAULT_SETTINGS = {
      layout: 'cards',
      shortcut: 'primary',
      maxText: 500,
      maxImage: 100,
      maxSnippets: 500,
      retentionDays: 0,
    };
    // Storage limits are picked from these tiers, in step with the native app;
    // the last one is "no limit" and stays a plain row count everywhere.
    const UNLIMITED_LIMIT = 1000000;
    const STORAGE_TIERS = [100, 500, 1000, UNLIMITED_LIMIT];
    const SETTING_LIMITS = {
      retentionDays: [0, 365],
    };
    const SHORTCUT_IDS = ['primary', 'secondary', 'control', 'off'];
    const MAX_TEXT_LENGTH = 50000;
    const MAX_IMAGE_LENGTH = 900000;
    const isApple = typeof navigator !== 'undefined'
      && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');

    function shortcutLabel(id) {
      if (id === 'secondary') return isApple ? '⌘⇧K' : 'Alt+Shift+K';
      if (id === 'control') return isApple ? '⌃⇧V' : 'Ctrl+Shift+V';
      if (id === 'off') return '';
      return isApple ? '⌘⇧V' : 'Alt+Shift+V';
    }

    function shortcutMatches(event, id) {
      if (id === 'off' || !event || !event.shiftKey) return false;
      const secondary = id === 'secondary';
      const key = secondary ? 'k' : 'v';
      const code = secondary ? 'KeyK' : 'KeyV';
      const typed = String(event.key || '').toLowerCase();
      if (typed !== key && event.code !== code) return false;
      if (id === 'control') {
        return event.ctrlKey === true && event.metaKey !== true && event.altKey !== true;
      }
      if (isApple) {
        return event.metaKey === true && event.ctrlKey !== true && event.altKey !== true;
      }
      return event.altKey === true && event.metaKey !== true && event.ctrlKey !== true;
    }

    /* ------------------------------------------------------------------ */
    /* Copy                                                               */
    /* ------------------------------------------------------------------ */

    const zh = {
      panel: '剪贴板',
      'page.title': '剪贴板与快捷短语',
      'page.subtitle': '仿 iCopy：历史、收藏、快捷短语与快速呼出；数据保存在本机 SQLite，可选跨应用文本监听。',
      'tab.clipboard': '剪贴板',
      'tab.snippets': '快捷短语',
      'clipboard.search': '搜索剪贴板历史',
      'snippets.search': '搜索快捷短语',
      'filter.all': '全部',
      'filter.text': '文本',
      'filter.image': '图片',
      'filter.pinned': '收藏',
      'layout.cards': '卡片视图',
      'layout.list': '列表视图',
      'action.read': '读取剪贴板',
      'action.reading': '读取中…',
      'action.clear': '清空',
      'action.copy': '复制',
      'action.pin': '收藏',
      'action.unpin': '取消收藏',
      'action.delete': '删除',
      'action.edit': '编辑',
      'action.new': '新建短语',
      'action.save': '保存',
      'action.cancel': '取消',
      'action.close': '关闭',
      'action.export': '导出短语',
      'action.import': '导入短语',
      'action.openPanel': '打开完整面板',
      hostWatch: '跨应用',
      'hostWatch.help': '保持手边原生程序运行，记录微信等其他应用复制的文本；当前版本仅文本',
      'hostWatch.unsupported': '手边原生程序未运行，或当前平台不支持跨应用监听',
      'hostWatch.enabled': '已开启跨应用监听',
      'hostWatch.disabled': '已关闭跨应用监听',
      'hostWatch.failed': '切换跨应用监听失败，请确认手边原生程序正在运行',
      'empty.clipboard.title': '还没有剪贴板记录',
      'empty.clipboard.body': '在 DSH 里复制文本，或点“读取剪贴板”；开启“跨应用”后可记录微信等应用的文本。',
      'empty.snippets.title': '还没有快捷短语',
      'empty.snippets.body': '把高频语句存成短语，回复时一键插入输入框。',
      'empty.search': '没有匹配的内容',
      'kind.text': '文本',
      'kind.image': '图片',
      'source.copy': '复制',
      'source.cut': '剪切',
      'source.paste': '粘贴',
      'source.manual': '读取',
      'source.auto': '自动',
      'source.host': '跨应用',
      'time.justNow': '刚刚',
      'time.minutes': '{n} 分钟前',
      'time.hours': '{n} 小时前',
      'time.yesterday': '昨天',
      'time.date': '{month}/{day}',
      'notice.copied': '已复制到剪贴板',
      'notice.inserted': '已插入输入框',
      'notice.attached': '已作为图片插入输入框',
      'notice.copyFailed': '复制失败，请检查浏览器剪贴板权限',
      'notice.readFailed': '无法读取剪贴板：{message}',
      'notice.readUnsupported': '当前页面无法访问剪贴板，请使用复制/粘贴记录',
      'notice.imported': '已导入 {n} 条短语',
      'notice.importFailed': '导入失败：{message}',
      'notice.exported': '已导出 {n} 条短语',
      'notice.saved': '已保存快捷短语',
      'notice.readEmpty': '剪贴板里没有可记录的内容',
      'notice.tooLarge': '内容过长，未记录（文本上限 5 万字符）',
      'notice.imageDisabled': '图片上限为 0，未保存这张图片',
      'notice.cleared': '已清空未收藏的记录',
      'notice.draftChanged': '输入框草稿已变化，已改为复制',
      'editor.newTitle': '新建快捷短语',
      'editor.editTitle': '编辑快捷短语',
      'editor.title': '标题（可选）',
      'editor.titlePlaceholder': '例如：客户问候',
      'editor.content': '内容',
      'editor.contentPlaceholder': '输入要快速插入的文本…',
      'editor.tag': '分组（可选）',
      'editor.tagPlaceholder': '例如：客服',
      'editor.error': '内容不能为空',
      'editor.hint': '短语以纯文本插入，支持多行。',
      'quick.title': '快速呼出',
      'quick.clipboard': '最近记录',
      'quick.snippets': '快捷短语',
      'quick.footer': '点击即插入输入框；没有输入框时复制到剪贴板',
      'quick.hint': '{shortcut} 呼出 · Esc 关闭 · ↑↓ 选择 · Enter 执行',
      'quick.hint.off': '快捷键已关闭 · Esc 关闭 · ↑↓ 选择 · Enter 执行',
      'quick.hint.copy': '跨应用复制模式 · Enter 复制到剪贴板 · Esc 关闭',
      'composer.open': '剪贴板与快捷短语（{shortcut}）',
      'composer.openOff': '剪贴板与快捷短语',
      'footer.count': '{n} 条记录',
      'footer.images': '{n} 张图片',
      'meta.chars': '{n} 字符',
      'action.confirm': '确定',
      'confirm.clear': '清空未收藏的剪贴板记录？',
      'confirm.deleteSnippet': '删除这条快捷短语？',
      'settings.open': '设置',
      'settings.title': '设置',
      'settings.desc': '调整 DSH 页面呼出快捷键、存储上限与留存时间。在线时保存后立即按新规则清理；数据保存在本机 SQLite。',
      'settings.shortcut': 'DSH 页面呼出快捷键',
      'settings.combo': '组合',
      'settings.shortcut.primary': '默认',
      'settings.shortcut.secondary': '备选（K）',
      'settings.shortcut.control': 'Ctrl 组合',
      'settings.shortcut.off': '关闭',
      'settings.shortcut.hint': '只影响 DSH 页面；原生悬浮窗使用自己的固定全局快捷键。如果和系统或其他插件冲突，可以换一个组合或关闭；输入框左侧的按钮始终可用。',
      'settings.storageSection': '存储上限与留存',
      'settings.maxText': '文本记录上限',
      'settings.maxText.hint': '100 / 500 / 1000 条或不限；置顶记录不计入上限。',
      'settings.maxImage': '图片记录上限',
      'settings.maxImage.hint': '不记录，或 100 / 500 / 1000 张或不限；置顶记录不计入上限。',
      'settings.maxSnippets': '快捷短语上限',
      'settings.maxSnippets.hint': '100 / 500 / 1000 条或不限；超出后保留最近更新的短语。',
      'settings.tierItems': '{n} 条',
      'settings.tierImages': '{n} 张',
      'settings.tierUnlimited': '不限',
      'settings.imageOff': '不记录',
      'settings.retentionDays': '保留天数',
      'settings.retention.hint': '0 表示永久保留；按最后复制时间计算，只清理未置顶的剪贴板记录，不影响快捷短语。',
      'settings.usage': '当前存储：文本 {text} 条 · 图片 {image} 张 · 快捷短语 {snippets} 条',
      'settings.pinned': '置顶记录不会被自动清理，也不占用上面的数量上限。',
      'settings.reset': '恢复上方默认值',
      'notice.settingsSaved': '设置已保存',
      'notice.settingsSavedPruned': '设置已保存，已清理 {n} 条超出限制的记录',
      'notice.hostSyncFailed': '无法连接手边原生程序；当前使用本地缓存，恢复后会同步未完成的操作',
      'notice.hostQueueSynced': '已同步离线期间的剪贴板操作',
      'notice.hostQueueDropped': '{n} 条离线操作未能同步，已跳过',
      'notice.hostQueueFull': '离线操作队列已满，较早的操作可能被丢弃',
      'notice.hostImportPartial': '{n} 条本地记录未能导入，请检查原生日志',
      'storage.full': '浏览器存储空间不足，已自动清理最旧的图片记录',
    };

    const en = {
      panel: 'Clipboard',
      'page.title': 'Clipboard and quick phrases',
      'page.subtitle': 'iCopy-style history, pins, quick phrases and a summon panel. Data stays in local SQLite; optional cross-app text capture.',
      'tab.clipboard': 'Clipboard',
      'tab.snippets': 'Quick phrases',
      'clipboard.search': 'Search clipboard history',
      'snippets.search': 'Search quick phrases',
      'filter.all': 'All',
      'filter.text': 'Text',
      'filter.image': 'Images',
      'filter.pinned': 'Pinned',
      'layout.cards': 'Card view',
      'layout.list': 'List view',
      'action.read': 'Read clipboard',
      'action.reading': 'Reading…',
      'action.clear': 'Clear',
      'action.copy': 'Copy',
      'action.pin': 'Pin',
      'action.unpin': 'Unpin',
      'action.delete': 'Delete',
      'action.edit': 'Edit',
      'action.new': 'New phrase',
      'action.save': 'Save',
      'action.cancel': 'Cancel',
      'action.close': 'Close',
      'action.export': 'Export',
      'action.import': 'Import',
      'action.openPanel': 'Open full panel',
      hostWatch: 'Cross-app',
      'hostWatch.help': 'Keep the AtHand native app running to record text copied in WeChat and other apps; text only for now',
      'hostWatch.unsupported': 'The AtHand native app is not running, or capture is unsupported on this platform',
      'hostWatch.enabled': 'Cross-app capture enabled',
      'hostWatch.disabled': 'Cross-app capture disabled',
      'hostWatch.failed': 'Could not toggle cross-app capture; make sure the AtHand native app is running',
      'empty.clipboard.title': 'No clipboard history yet',
      'empty.clipboard.body': 'Copy text in DSH, click “Read clipboard”, or enable “Cross-app” to capture text from other apps.',
      'empty.snippets.title': 'No quick phrases yet',
      'empty.snippets.body': 'Save a sentence you type often, then insert it into the composer in one click.',
      'empty.search': 'Nothing matches',
      'kind.text': 'Text',
      'kind.image': 'Image',
      'source.copy': 'Copy',
      'source.cut': 'Cut',
      'source.paste': 'Paste',
      'source.manual': 'Manual',
      'source.auto': 'Auto',
      'source.host': 'Cross-app',
      'time.justNow': 'Just now',
      'time.minutes': '{n} min ago',
      'time.hours': '{n} h ago',
      'time.yesterday': 'Yesterday',
      'time.date': '{month}/{day}',
      'notice.copied': 'Copied to clipboard',
      'notice.inserted': 'Inserted into the composer',
      'notice.attached': 'Image attached to the composer',
      'notice.copyFailed': 'Copy failed; check the browser clipboard permission',
      'notice.readFailed': 'Could not read the clipboard: {message}',
      'notice.readUnsupported': 'This page cannot access the clipboard; copy or paste to record instead',
      'notice.imported': 'Imported {n} phrases',
      'notice.importFailed': 'Import failed: {message}',
      'notice.exported': 'Exported {n} phrases',
      'notice.saved': 'Quick phrase saved',
      'notice.readEmpty': 'Nothing on the clipboard to record',
      'notice.tooLarge': 'Content is too large to record (50k character limit)',
      'notice.imageDisabled': 'The image limit is 0, so this image was not saved',
      'notice.cleared': 'Cleared unpinned history',
      'notice.draftChanged': 'The composer draft changed, so the text was copied instead',
      'editor.newTitle': 'New quick phrase',
      'editor.editTitle': 'Edit quick phrase',
      'editor.title': 'Title (optional)',
      'editor.titlePlaceholder': 'e.g. Customer greeting',
      'editor.content': 'Content',
      'editor.contentPlaceholder': 'Text to insert…',
      'editor.tag': 'Group (optional)',
      'editor.tagPlaceholder': 'e.g. Support',
      'editor.error': 'Content is required',
      'editor.hint': 'Phrases are inserted as plain text and may span multiple lines.',
      'quick.title': 'Quick summon',
      'quick.clipboard': 'Recent',
      'quick.snippets': 'Quick phrases',
      'quick.footer': 'Click to insert; without a composer the text is copied',
      'quick.hint': '{shortcut} to summon · Esc to close · ↑↓ to move · Enter to run',
      'quick.hint.off': 'Shortcut off · Esc close · ↑↓ select · Enter run',
      'quick.hint.copy': 'Cross-app copy mode · Enter copies · Esc closes',
      'composer.open': 'Clipboard and quick phrases ({shortcut})',
      'composer.openOff': 'Clipboard and quick phrases',
      'footer.count': '{n} items',
      'footer.images': '{n} images',
      'meta.chars': '{n} chars',
      'action.confirm': 'Confirm',
      'confirm.clear': 'Clear all unpinned clipboard history?',
      'confirm.deleteSnippet': 'Delete this quick phrase?',
      'settings.open': 'Settings',
      'settings.title': 'Settings',
      'settings.desc': 'Tune the DSH page summon shortcut, storage limits, and retention. While online, limits apply immediately on save; data stays in local SQLite.',
      'settings.shortcut': 'DSH page summon shortcut',
      'settings.combo': 'Combination',
      'settings.shortcut.primary': 'Default',
      'settings.shortcut.secondary': 'Alternate (K)',
      'settings.shortcut.control': 'Ctrl combo',
      'settings.shortcut.off': 'Off',
      'settings.shortcut.hint': 'Applies to the DSH page only; the native overlay keeps its own fixed global shortcut. If it conflicts with the system or another plugin, choose another combination or turn it off. The composer button always works.',
      'settings.storageSection': 'Storage and retention',
      'settings.maxText': 'Text history limit',
      'settings.maxText.hint': '100, 500, 1000 items or no limit; pinned items are not counted.',
      'settings.maxImage': 'Image history limit',
      'settings.maxImage.hint': 'Do not record, or 100, 500, 1000 images or no limit; pinned items are not counted.',
      'settings.maxSnippets': 'Quick phrase limit',
      'settings.maxSnippets.hint': '100, 500, 1000 items or no limit; the most recently updated are kept.',
      'settings.tierItems': '{n} items',
      'settings.tierImages': '{n} images',
      'settings.tierUnlimited': 'No limit',
      'settings.imageOff': 'Do not record',
      'settings.retentionDays': 'Keep for (days)',
      'settings.retention.hint': '0 means forever; based on the last copy time, only unpinned clipboard items are removed. Quick phrases are never aged out.',
      'settings.usage': 'Stored now: {text} text · {image} images · {snippets} phrases',
      'settings.pinned': 'Pinned items are never cleaned up automatically and do not count toward the limits above.',
      'settings.reset': 'Reset fields above',
      'notice.settingsSaved': 'Settings saved',
      'notice.settingsSavedPruned': 'Settings saved; {n} items beyond the new limits were removed',
      'notice.hostSyncFailed': 'Could not reach the AtHand native app; local cache is shown and pending actions will sync after reconnecting',
      'notice.hostQueueSynced': 'Offline clipboard actions have been synced',
      'notice.hostQueueDropped': '{n} offline actions could not be synced and were skipped',
      'notice.hostQueueFull': 'The offline action queue is full; older actions may be dropped',
      'notice.hostImportPartial': '{n} local records could not be imported; check the native log',
      'storage.full': 'Browser storage is full; the oldest image records were pruned',
    };

    const fallbackT = (key, params) => String(key).replace(/\{(\w+)\}/g, (match, name) => {
      if (params && params[name] !== undefined && params[name] !== null) return String(params[name]);
      return match;
    });
    let translate = fallbackT;
    let hostContext = null;
    let hostBridge = null;

    /* ------------------------------------------------------------------ */
    /* Small utilities                                                    */
    /* ------------------------------------------------------------------ */

    const uid = () => 'bc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    function adoptLegacyStorage(storage) {
      if (!storage) return;
      try {
        Object.keys(LEGACY_STORAGE_KEYS).forEach((key) => {
          if (storage.getItem(key) !== null) return;
          const legacy = storage.getItem(LEGACY_STORAGE_KEYS[key]);
          if (legacy !== null) storage.setItem(key, legacy);
        });
      } catch (error) {
        /* A full or blocked storage keeps the store on its in-memory fallback. */
      }
    }

    let storageCache;
    function safeStorage() {
      if (storageCache !== undefined) return storageCache;
      try {
        storageCache = window.localStorage || null;
      } catch (error) {
        storageCache = null;
      }
      adoptLegacyStorage(storageCache);
      return storageCache;
    }

    function clamp(value, min, max) {
      return value < min ? min : value > max ? max : value;
    }

    function firstLine(text) {
      const line = String(text || '').split('\n').find((part) => part.trim() !== '');
      return line ? line.trim() : '';
    }

    function utf8Length(value) {
      const text = String(value || '');
      if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).length;
      try {
        return unescape(encodeURIComponent(text)).length;
      } catch (error) {
        return text.length;
      }
    }

    function settingNumber(value, range, fallback) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return fallback;
      return clamp(Math.round(parsed), range[0], range[1]);
    }

    // Limits only move up to the next tier: rounding down would drop history.
    function settingTier(value, fallback) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return fallback;
      for (const tier of STORAGE_TIERS) {
        if (parsed <= tier) return tier;
      }
      return UNLIMITED_LIMIT;
    }

    // Zero keeps its own meaning for pictures: capture is off.
    function settingImageTier(value, fallback) {
      if (Number(value) === 0) return 0;
      return settingTier(value, fallback);
    }

    function sanitizeSettings(raw) {
      const source = raw && typeof raw === 'object' ? raw : {};
      return {
        layout: source.layout === 'list' ? 'list' : 'cards',
        shortcut: SHORTCUT_IDS.includes(source.shortcut) ? source.shortcut : DEFAULT_SETTINGS.shortcut,
        maxText: settingTier(source.maxText, DEFAULT_SETTINGS.maxText),
        maxImage: settingImageTier(source.maxImage, DEFAULT_SETTINGS.maxImage),
        maxSnippets: settingTier(source.maxSnippets, DEFAULT_SETTINGS.maxSnippets),
        retentionDays: settingNumber(source.retentionDays, SETTING_LIMITS.retentionDays, DEFAULT_SETTINGS.retentionDays),
      };
    }

    function capItems(items, settings) {
      const cutoff = settings.retentionDays > 0
        ? Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000
        : 0;
      let texts = 0;
      let images = 0;
      const keep = new Set();
      for (const item of items) {
        if (item.pinned) {
          keep.add(item.id);
          continue;
        }
        if (cutoff > 0 && item.createdAt < cutoff) continue;
        if (item.kind === 'image') {
          if (images < settings.maxImage) {
            keep.add(item.id);
            images += 1;
          }
        } else if (texts < settings.maxText) {
          keep.add(item.id);
          texts += 1;
        }
      }
      return items.filter((item) => keep.has(item.id));
    }

    function timeLabel(stamp, t) {
      const value = Number(stamp) || 0;
      const delta = Date.now() - value;
      if (delta < 60 * 1000) return t('time.justNow');
      if (delta < 60 * 60 * 1000) return t('time.minutes', { n: Math.floor(delta / 60000) });
      if (delta < 24 * 60 * 60 * 1000) return t('time.hours', { n: Math.floor(delta / 3600000) });
      const date = new Date(value);
      const yesterday = new Date(Date.now() - 86400000);
      if (date.toDateString() === yesterday.toDateString()) return t('time.yesterday');
      return t('time.date', { month: date.getMonth() + 1, day: date.getDate() });
    }

    function sanitizeItem(raw) {
      if (!raw || typeof raw !== 'object') return null;
      const kind = raw.kind === 'image' ? 'image' : 'text';
      const createdAt = Number(raw.createdAt) || Date.now();
      const pinned = raw.pinned === true;
      const source = ['copy', 'cut', 'paste', 'manual', 'auto', 'host'].includes(raw.source) ? raw.source : 'manual';
      if (kind === 'image') {
        const image = typeof raw.image === 'string' ? raw.image : '';
        const local = image.startsWith('data:image/') && image.length <= MAX_IMAGE_LENGTH;
        const hosted = image.startsWith(HOST_API + '/assets/');
        if (!local && !hosted) return null;
        return {
          id: typeof raw.id === 'string' ? raw.id : uid(),
          kind,
          text: '',
          image,
          assetId: typeof raw.assetId === 'string' ? raw.assetId : '',
          createdAt,
          pinned,
          source,
        };
      }
      const text = typeof raw.text === 'string' ? raw.text : '';
      if (text.trim() === '') return null;
      return { id: typeof raw.id === 'string' ? raw.id : uid(), kind, text, image: '', createdAt, pinned, source };
    }

    function sanitizeSnippet(raw) {
      if (!raw || typeof raw !== 'object') return null;
      const content = typeof raw.content === 'string' ? raw.content : '';
      if (content.trim() === '') return null;
      const title = typeof raw.title === 'string' && raw.title.trim() !== '' ? raw.title.trim() : firstLine(content).slice(0, 32);
      return {
        id: typeof raw.id === 'string' ? raw.id : uid(),
        title,
        content,
        tag: typeof raw.tag === 'string' ? raw.tag.trim() : '',
        createdAt: Number(raw.createdAt) || Date.now(),
        updatedAt: Number(raw.updatedAt) || Number(raw.createdAt) || Date.now(),
      };
    }

    /* ------------------------------------------------------------------ */
    /* Notifier                                                           */
    /* ------------------------------------------------------------------ */

    const notifier = (() => {
      let current = null;
      let serial = 0;
      const listeners = new Set();
      const getSnapshot = () => current;
      const subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      };
      const push = (key, params) => {
        current = { id: ++serial, key, params: params || null };
        listeners.forEach((listener) => listener());
      };
      return { getSnapshot, subscribe, push };
    })();

    /* ------------------------------------------------------------------ */
    /* Store                                                              */
    /* ------------------------------------------------------------------ */

    function initialState() {
      return {
        items: [],
        snippets: [],
        settings: { ...DEFAULT_SETTINGS },
      };
    }

    function loadState() {
      const storage = safeStorage();
      if (!storage) return initialState();
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return initialState();
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return initialState();
        const items = Array.isArray(data.items) ? data.items.map(sanitizeItem).filter(Boolean) : [];
        const snippets = Array.isArray(data.snippets) ? data.snippets.map(sanitizeSnippet).filter(Boolean) : [];
        const settings = sanitizeSettings(data.settings);
        return {
          items: capItems(items, settings),
          snippets: snippets.slice(0, settings.maxSnippets),
          settings,
        };
      } catch (error) {
        return initialState();
      }
    }

    function createStore() {
      let state = loadState();
      let saveTimer = null;
      const listeners = new Set();

      const getSnapshot = () => state;

      const subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      };

      const emit = () => {
        listeners.forEach((listener) => listener());
      };

      const writeNow = () => {
        if (hostMode) return;
        const storage = safeStorage();
        if (!storage) return;
        let attempt = 0;
        while (attempt < 8) {
          attempt += 1;
          try {
            storage.setItem(STORAGE_KEY, JSON.stringify(state));
            return;
          } catch (error) {
            const removable = state.items.filter((item) => !item.pinned);
            if (removable.length <= 1) {
              notifier.push('storage.full');
              return;
            }
            const images = removable.filter((item) => item.kind === 'image');
            const drop = images.length > 0 ? images[images.length - 1] : removable[removable.length - 1];
            state = { ...state, items: state.items.filter((item) => item.id !== drop.id) };
            emit();
          }
        }
      };

      const persist = (immediate) => {
        if (hostMode) return;
        if (immediate) {
          if (saveTimer !== null) {
            clearTimeout(saveTimer);
            saveTimer = null;
          }
          writeNow();
          return;
        }
        if (saveTimer !== null) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          saveTimer = null;
          writeNow();
        }, 120);
      };

      let hostMode = false;

      const commit = (next, immediate) => {
        state = next;
        persist(immediate === true);
        emit();
      };

      const pushHost = (operation, queued) => {
        if (!hostBridge) return;
        const queueFallback = () => {
          if (queued) hostBridge.enqueue(queued.op, queued.data);
        };
        if (!hostBridge.getStatus().supported) {
          queueFallback();
          return;
        }
        try {
          const pending = operation();
          if (pending && typeof pending.catch === 'function') {
            pending.catch(() => {
              queueFallback();
              notifier.push('notice.hostSyncFailed');
            });
          }
        } catch (error) {
          queueFallback();
          notifier.push('notice.hostSyncFailed');
        }
      };

      const addTextAt = (raw, source, when, preserveSource) => {
        const text = String(raw === undefined || raw === null ? '' : raw);
        if (text.trim() === '') return false;
        if (utf8Length(text) > MAX_TEXT_LENGTH) {
          notifier.push('notice.tooLarge');
          return false;
        }
        const createdAt = Number.isFinite(when) ? Number(when) : Date.now();
        const existing = state.items.find((item) => item.kind === 'text' && item.text === text);
        const id = existing ? existing.id : uid();
        let items;
        if (existing) {
          const nextCreatedAt = preserveSource
            ? Math.max(Number(existing.createdAt) || 0, createdAt)
            : createdAt;
          const updated = { ...existing, createdAt: nextCreatedAt };
          if (!preserveSource) updated.source = source || existing.source;
          items = [updated].concat(state.items.filter((item) => item.id !== existing.id));
        } else {
          items = [{
            id,
            kind: 'text',
            text,
            image: '',
            createdAt,
            pinned: false,
            source: source || 'manual',
          }].concat(state.items);
        }
        commit({ ...state, items: capItems(items, state.settings) });
        const queued = { id, text, source: source || 'manual', createdAt };
        pushHost(() => hostBridge.addText(queued), { op: 'addText', data: queued });
        return true;
      };

      const addText = (raw, source) => addTextAt(raw, source, Date.now(), false);
      const addHostText = (raw, createdAt) => addTextAt(raw, 'host', createdAt, true);

      const addImage = (dataUrl, source) => {
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return false;
        if (state.settings.maxImage <= 0) {
          notifier.push('notice.imageDisabled');
          return false;
        }
        if (dataUrl.length > MAX_IMAGE_LENGTH) {
          notifier.push('notice.tooLarge');
          return false;
        }
        const existing = state.items.find((item) => item.kind === 'image' && item.image === dataUrl);
        const id = existing ? existing.id : uid();
        const createdAt = Date.now();
        let items;
        if (existing) {
          const updated = { ...existing, createdAt, source: source || existing.source };
          items = [updated].concat(state.items.filter((item) => item.id !== existing.id));
        } else {
          items = [{
            id,
            kind: 'image',
            text: '',
            image: dataUrl,
            createdAt,
            pinned: false,
            source: source || 'manual',
          }].concat(state.items);
        }
        commit({ ...state, items: capItems(items, state.settings) });
        const queued = { id, image: dataUrl, source: source || 'manual', createdAt };
        pushHost(() => hostBridge.addImage(dataUrl, source || 'manual', id, createdAt), { op: 'addImage', data: queued });
        return true;
      };

      const togglePin = (id) => {
        const item = state.items.find((candidate) => candidate.id === id);
        if (!item) return;
        const pinned = !item.pinned;
        commit({
          ...state,
          items: state.items.map((candidate) => candidate.id === id ? { ...candidate, pinned } : candidate),
        }, true);
        pushHost(() => hostBridge.setPinned(id, pinned), { op: 'setPinned', data: { id, pinned } });
      };

      const removeItem = (id) => {
        commit({ ...state, items: state.items.filter((item) => item.id !== id) }, true);
        pushHost(() => hostBridge.removeItem(id), { op: 'removeItem', data: { id } });
      };

      const clearUnpinned = () => {
        const before = Date.now();
        commit({ ...state, items: state.items.filter((item) => item.pinned) }, true);
        pushHost(() => hostBridge.clearUnpinned(before), { op: 'clear', data: { before } });
      };

      const saveSnippet = (input) => {
        const content = String(input && input.content ? input.content : '').trim();
        if (content === '') return false;
        const title = String(input.title || '').trim() || firstLine(content).slice(0, 32);
        const tag = String(input.tag || '').trim();
        const existing = input.id ? state.snippets.find((snippet) => snippet.id === input.id) : undefined;
        const id = existing ? existing.id : uid();
        const now = Date.now();
        let snippets;
        if (existing) {
          const updated = { ...existing, title, content, tag, updatedAt: now };
          snippets = [updated].concat(state.snippets.filter((snippet) => snippet.id !== existing.id));
        } else {
          snippets = [{
            id,
            title,
            content,
            tag,
            createdAt: now,
            updatedAt: now,
          }].concat(state.snippets);
        }
        commit({ ...state, snippets: snippets.slice(0, state.settings.maxSnippets) }, true);
        const queued = {
          id,
          title,
          content,
          tag,
          createdAt: existing ? existing.createdAt : now,
          updatedAt: now,
        };
        pushHost(() => hostBridge.saveSnippet(queued), { op: 'saveSnippet', data: queued });
        return true;
      };

      const removeSnippet = (id) => {
        commit({ ...state, snippets: state.snippets.filter((snippet) => snippet.id !== id) }, true);
        pushHost(() => hostBridge.removeSnippet(id), { op: 'removeSnippet', data: { id } });
      };

      const mergeSnippets = (list) => {
        if (!Array.isArray(list)) return 0;
        const next = state.snippets.slice();
        let added = 0;
        for (const raw of list) {
          const candidate = sanitizeSnippet(raw);
          if (!candidate) continue;
          const index = next.findIndex((snippet) => snippet.id === candidate.id || snippet.content === candidate.content);
          if (index >= 0) {
            next[index] = {
              ...next[index],
              title: candidate.title,
              tag: candidate.tag,
              content: candidate.content,
              updatedAt: Date.now(),
            };
          } else {
            next.unshift({
              ...candidate,
              id: uid(),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            added += 1;
          }
        }
        commit({ ...state, snippets: next.slice(0, state.settings.maxSnippets) }, true);
        pushHost(() => hostBridge.mergeSnippets(list), { op: 'mergeSnippets', data: { list } });
        return added;
      };

      async function saveSettingsToHost(settings, localRemoved) {
        if (!hostBridge) return { removed: localRemoved, queued: false };
        if (!hostBridge.getStatus().supported) {
          hostBridge.enqueue('updateSettings', { settings });
          return { removed: localRemoved, queued: true };
        }
        try {
          const data = await hostBridge.updateSettings(settings);
          const pruned = data && Number.isFinite(Number(data.pruned))
            ? Math.max(0, Number(data.pruned))
            : localRemoved;
          return { removed: pruned, queued: false };
        } catch (error) {
          hostBridge.enqueue('updateSettings', { settings });
          notifier.push('notice.hostSyncFailed');
          return { removed: localRemoved, queued: true };
        }
      }

      const updateSettings = async (patch) => {
        const settings = sanitizeSettings({ ...state.settings, ...(patch && typeof patch === 'object' ? patch : {}) });
        const items = capItems(state.items, settings);
        const snippets = state.snippets.slice(0, settings.maxSnippets);
        const removed = (state.items.length - items.length) + (state.snippets.length - snippets.length);
        state = { ...state, items, snippets, settings };
        persist(true);
        emit();
        return saveSettingsToHost(settings, removed);
      };

      const setLayout = (value) => {
        void updateSettings({ layout: value === 'list' ? 'list' : 'cards' }).catch(() => {
          notifier.push('notice.hostSyncFailed');
        });
      };

      const pruneExpired = () => {
        if (state.settings.retentionDays <= 0) return 0;
        const items = capItems(state.items, state.settings);
        const removed = state.items.length - items.length;
        if (removed > 0) commit({ ...state, items }, true);
        pushHost(() => hostBridge.prune(), { op: 'prune', data: {} });
        return removed;
      };

      const hydrateHost = (data) => {
        if (!data || typeof data !== 'object') return false;
        const settings = sanitizeSettings(data.settings);
        const items = Array.isArray(data.items) ? data.items.map(sanitizeItem).filter(Boolean) : [];
        const snippets = Array.isArray(data.snippets) ? data.snippets.map(sanitizeSnippet).filter(Boolean) : [];
        if (saveTimer !== null) {
          clearTimeout(saveTimer);
          saveTimer = null;
        }
        hostMode = true;
        state = { items, snippets, settings };
        emit();
        return true;
      };

      const leaveHostMode = () => {
        if (!hostMode) return false;
        hostMode = false;
        persist(true);
        return true;
      };

      const flush = () => {
        if (hostMode) return;
        if (saveTimer !== null) {
          clearTimeout(saveTimer);
          saveTimer = null;
          writeNow();
        }
      };

      return {
        getSnapshot,
        subscribe,
        addText,
        addHostText,
        addImage,
        togglePin,
        removeItem,
        clearUnpinned,
        saveSnippet,
        removeSnippet,
        mergeSnippets,
        setLayout,
        updateSettings,
        pruneExpired,
        hydrateHost,
        leaveHostMode,
        isHostMode: () => hostMode,
        flush,
      };
    }

    const store = createStore();

    /* ------------------------------------------------------------------ */
    /* Clipboard IO                                                       */
    /* ------------------------------------------------------------------ */

    function blobToDataUrl(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('read failed'));
        reader.readAsDataURL(blob);
      });
    }

    async function imageFileFromDataUrl(source) {
      try {
        if (typeof source !== 'string' || typeof File !== 'function') return null;
        let blob = null;
        if (source.startsWith('data:')) {
          const match = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(source);
          if (!match) return null;
          const mediaType = match[1].toLowerCase();
          if (mediaType !== 'image/png' && mediaType !== 'image/jpeg' && mediaType !== 'image/webp' && mediaType !== 'image/gif') {
            return null;
          }
          const binary = atob(match[2].replace(/[^A-Za-z0-9+/=]/g, ''));
          const bytes = new Uint8Array(binary.length);
          for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
          blob = new Blob([bytes], { type: mediaType });
        } else if (source.startsWith(HOST_API + '/assets/')) {
          const response = await fetch(source, { credentials: 'same-origin', cache: 'no-store' });
          if (!response.ok) return null;
          blob = await response.blob();
          if (!blob.type.startsWith('image/')) return null;
        } else {
          return null;
        }
        const mediaType = blob.type || 'image/png';
        const extension = mediaType === 'image/jpeg' ? 'jpg' : mediaType.slice(6);
        return new File([blob], 'clipboard-' + Date.now() + '.' + extension, { type: mediaType });
      } catch (error) {
        return null;
      }
    }

    function shrinkImage(dataUrl) {
      return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
          try {
            const max = 720;
            const scale = Math.min(1, max / Math.max(image.width || 1, image.height || 1));
            if (scale === 1 && dataUrl.length < 320000) {
              resolve(dataUrl);
              return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round((image.width || 1) * scale));
            canvas.height = Math.max(1, Math.round((image.height || 1) * scale));
            const context = canvas.getContext('2d');
            if (!context) {
              resolve(dataUrl);
              return;
            }
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            const shrunk = canvas.toDataURL('image/jpeg', 0.82);
            resolve(shrunk.length < dataUrl.length ? shrunk : dataUrl);
          } catch (error) {
            resolve(dataUrl);
          }
        };
        image.onerror = () => resolve(dataUrl);
        image.src = dataUrl;
      });
    }

    async function addImageBlob(blob, source) {
      try {
        const raw = await blobToDataUrl(blob);
        const shrunk = await shrinkImage(raw);
        store.addImage(shrunk, source);
      } catch (error) {
        /* An unreadable image must not break the paste itself. */
      }
    }

    async function readClipboardNow() {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.readText !== 'function') {
        throw new Error(translate('notice.readUnsupported'));
      }
      const text = await clipboard.readText();
      if (text && text.trim() !== '') store.addText(text, 'manual');
      let images = 0;
      if (typeof clipboard.read === 'function' && typeof window.ClipboardItem !== 'undefined') {
        try {
          const entries = await clipboard.read();
          for (const entry of entries) {
            for (const type of entry.types) {
              if (!type.startsWith('image/')) continue;
              const blob = await entry.getType(type);
              await addImageBlob(blob, 'manual');
              images += 1;
            }
          }
        } catch (error) {
          /* Text may still have been read; image permission is optional. */
        }
      }
      return { text: !!(text && text.trim() !== ''), images };
    }

    function legacyCopy(text) {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', 'readonly');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        return ok;
      } catch (error) {
        return false;
      }
    }

    async function copyText(text) {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (error) {
        /* fall through to the legacy path */
      }
      return legacyCopy(text);
    }

    function dataUrlToPngBlob(dataUrl) {
      return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = image.width || 1;
            canvas.height = image.height || 1;
            const context = canvas.getContext('2d');
            if (!context) {
              resolve(null);
              return;
            }
            context.drawImage(image, 0, 0);
            canvas.toBlob((blob) => resolve(blob), 'image/png');
          } catch (error) {
            resolve(null);
          }
        };
        image.onerror = () => resolve(null);
        image.src = dataUrl;
      });
    }

    async function copyImage(dataUrl) {
      try {
        if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function') return false;
        if (typeof window.ClipboardItem === 'undefined') return false;
        const blob = await dataUrlToPngBlob(dataUrl);
        if (!blob) return false;
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
        return true;
      } catch (error) {
        return false;
      }
    }

    /* ------------------------------------------------------------------ */
    /* Host bridge: cross-app clipboard capture                           */
    /* ------------------------------------------------------------------ */

    hostBridge = (() => {
      const listeners = new Set();
      let status = {
        supported: false,
        mode: 'local',
        storage: 'local',
        enabled: false,
        watchSupported: false,
        instanceId: '',
        count: 0,
        counts: { text: 0, image: 0, snippets: 0 },
        platform: '',
        revision: 0,
      };
      let started = false;
      let timer = null;
      let syncing = false;
      let refreshTimer = null;
      let statusFlight = null;
      let hydratedRevision = 0;
      let migrationDone = false;
      let migrationFlight = null;
      let offlineNotified = false;
      let ticking = false;
      const PENDING_KEY = 'dsh.athand.pending.v1';
      const MAX_PENDING = 200;
      const QUEUE_OPS = new Set([
        'addText', 'addImage', 'setPinned', 'removeItem', 'clear',
        'saveSnippet', 'removeSnippet', 'mergeSnippets', 'updateSettings', 'prune',
      ]);
      let pending = loadPending();
      let replaying = false;
      let queueFullNotified = false;

      function loadPending() {
        const storage = safeStorage();
        if (!storage) return [];
        try {
          const parsed = JSON.parse(storage.getItem(PENDING_KEY) || '[]');
          if (!Array.isArray(parsed)) return [];
          return parsed.filter((entry) => entry
            && typeof entry === 'object'
            && QUEUE_OPS.has(entry.op)
            && entry.data
            && typeof entry.data === 'object');
        } catch (error) {
          return [];
        }
      }

      function persistPending() {
        const storage = safeStorage();
        if (!storage) return;
        try {
          storage.setItem(PENDING_KEY, JSON.stringify(pending));
        } catch (error) {
          if (pending.length > 50) {
            pending = pending.slice(-50);
            try {
              storage.setItem(PENDING_KEY, JSON.stringify(pending));
              return;
            } catch (inner) {
              /* The queue remains in memory for this page. */
            }
          }
          if (!queueFullNotified) {
            queueFullNotified = true;
            notifier.push('notice.hostQueueFull');
          }
        }
      }

      function enqueue(op, data) {
        if (!QUEUE_OPS.has(op) || !data || typeof data !== 'object') return;
        pending.push({ op, data });
        if (pending.length > MAX_PENDING) {
          pending = pending.slice(-MAX_PENDING);
          if (!queueFullNotified) {
            queueFullNotified = true;
            notifier.push('notice.hostQueueFull');
          }
        }
        persistPending();
      }

      const emit = () => listeners.forEach((listener) => listener());
      const getStatus = () => status;
      const subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      };

      const sameCounts = (left, right) => left && right
        && left.text === right.text
        && left.image === right.image
        && left.snippets === right.snippets;

      const setStatus = (patch) => {
        const next = { ...status, ...patch };
        if (next.supported === status.supported
          && next.mode === status.mode
          && next.storage === status.storage
          && next.enabled === status.enabled
          && next.watchSupported === status.watchSupported
          && next.instanceId === status.instanceId
          && next.count === status.count
          && sameCounts(next.counts, status.counts)
          && next.platform === status.platform
          && next.revision === status.revision) return;
        status = next;
        emit();
      };

      async function request(path, init) {
        if (typeof fetch !== 'function') {
          const error = new Error('fetch unavailable');
          error.status = 0;
          throw error;
        }
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
        let response;
        try {
          response = await fetch(HOST_API + path, {
            credentials: 'same-origin',
            cache: 'no-store',
            ...(init || {}),
            ...(controller ? { signal: controller.signal } : {}),
          });
        } catch (error) {
          if (error && error.name === 'AbortError') {
            const timeoutError = new Error('host bridge timeout');
            timeoutError.status = 0;
            throw timeoutError;
          }
          throw error;
        } finally {
          if (timer !== null) clearTimeout(timer);
        }
        if (!response.ok) {
          const error = new Error('host bridge ' + response.status);
          error.status = response.status;
          throw error;
        }
        return response.json();
      }

      function applyStatus(data) {
        if (!data || data.protocol !== 'athand/host-v1') return false;
        if (data.supported !== false) offlineNotified = false;
        setStatus({
          supported: data.supported !== false,
          mode: typeof data.mode === 'string' ? data.mode : 'sqlite',
          storage: typeof data.storage === 'string' ? data.storage : 'sqlite',
          enabled: data.enabled === true,
          watchSupported: typeof data.watchSupported === 'boolean' ? data.watchSupported : status.watchSupported,
          instanceId: typeof data.instanceId === 'string' ? data.instanceId : status.instanceId,
          count: Number.isFinite(data.count) ? Math.max(0, Number(data.count)) : status.count,
          counts: data.counts && typeof data.counts === 'object'
            ? {
              text: Math.max(0, Number(data.counts.text) || 0),
              image: Math.max(0, Number(data.counts.image) || 0),
              snippets: Math.max(0, Number(data.counts.snippets) || 0),
            }
            : status.counts,
          platform: typeof data.platform === 'string' ? data.platform : status.platform,
          revision: Number.isFinite(data.revision) ? Number(data.revision) : status.revision,
        });
        return true;
      }

      const fallbackToLocal = () => {
        store.leaveHostMode();
        hydratedRevision = 0;
        setStatus({ supported: false, mode: 'local', storage: 'local' });
        if (!offlineNotified) {
          offlineNotified = true;
          notifier.push('notice.hostSyncFailed');
        }
      };

      async function fetchStatus() {
        if (statusFlight !== null) return statusFlight;
        statusFlight = (async () => {
          try {
            const data = await request('/status');
            if (!applyStatus(data)) fallbackToLocal();
          } catch (error) {
            if (error && (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 503 || error.status === 0)) {
              fallbackToLocal();
            }
          } finally {
            statusFlight = null;
          }
        })();
        return statusFlight;
      }

      async function refresh(force) {
        if (!status.supported || syncing || replaying) return;
        syncing = true;
        try {
          if (!migrationDone) await ensureMigration();
          if (pending.length > 0) {
            const drained = await replayPending();
            if (!drained) return;
          }
          const since = !force && hydratedRevision > 0 ? hydratedRevision : 0;
          const data = await request('/state' + (since > 0 ? '?since=' + encodeURIComponent(String(since)) : ''));
          if (data && data.changed === false) {
            applyStatus(data);
            return;
          }
          if (!applyStatus(data) || !Array.isArray(data.items)) return;
          // A local mutation may have been queued while the request was in
          // flight; hydrating now would hide it from the user until replay.
          if (pending.length > 0) return;
          if (store.hydrateHost(data)) hydratedRevision = Number(data.revision) || 0;
        } catch (error) {
          if (error && (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 503 || error.status === 0)) {
            fallbackToLocal();
          } else if (error) {
            notifier.push('notice.hostSyncFailed');
          }
        } finally {
          syncing = false;
        }
      }

      function scheduleRefresh() {
        if (refreshTimer !== null) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          refreshTimer = null;
          void refresh(true);
        }, 80);
      }

      function blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error || new Error('could not read image'));
          reader.readAsDataURL(blob);
        });
      }

      async function prepareLegacyPayload(legacy) {
        const items = [];
        let dropped = 0;
        for (const item of legacy.items) {
          if (item.kind !== 'image' || !String(item.image || '').startsWith(HOST_API + '/assets/')) {
            items.push(item);
            continue;
          }
          const controller = typeof AbortController === 'function' ? new AbortController() : null;
          const timer = controller ? setTimeout(() => controller.abort(), 5000) : null;
          try {
            const response = await fetch(item.image, {
              credentials: 'same-origin',
              cache: 'no-store',
              ...(controller ? { signal: controller.signal } : {}),
            });
            if (!response.ok) throw new Error('asset request failed');
            const blob = await response.blob();
            if (!String(blob.type || '').startsWith('image/')) throw new Error('asset is not an image');
            items.push({ ...item, image: await blobToDataURL(blob) });
          } catch (error) {
            dropped += 1;
          } finally {
            if (timer !== null) clearTimeout(timer);
          }
        }
        return { items, dropped };
      }

      const nativeHasData = () => status.count > 0
        || status.counts.text > 0
        || status.counts.image > 0
        || status.counts.snippets > 0;

      async function ensureMigration() {
        if (migrationDone) return;
        if (migrationFlight !== null) return migrationFlight;
        migrationFlight = (async () => {
          await migrate();
          migrationDone = true;
        })().finally(() => {
          migrationFlight = null;
        });
        return migrationFlight;
      }

      // Import the pre-native browser snapshot exactly once. Later offline
      // changes are replayed as operations, so a native clear/delete cannot be
      // undone by stale localStorage.
      async function migrate() {
        const storage = safeStorage();
        if (storage && storage.getItem(HOST_MIGRATION_KEY) === '1') return;
        const legacy = store.getSnapshot();
        const hasData = legacy.items.length > 0
          || legacy.snippets.length > 0
          || JSON.stringify(legacy.settings) !== JSON.stringify(DEFAULT_SETTINGS);
        if (hasData) {
          const prepared = await prepareLegacyPayload(legacy);
          const payload = { ...legacy, items: prepared.items };
          if (nativeHasData()) delete payload.settings;
          const result = await request('/import', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ state: payload }),
          });
          const errors = result && result.imported && Array.isArray(result.imported.errors)
            ? result.imported.errors.length
            : 0;
          if (prepared.dropped + errors > 0) {
            notifier.push('notice.hostImportPartial', { n: prepared.dropped + errors });
          }
        }
        if (storage) {
          try {
            storage.setItem(HOST_MIGRATION_KEY, '1');
          } catch (error) {
            /* A failed marker only retries the merge next time. */
          }
        }
      }

      async function sendPending(entry) {
        const data = entry.data;
        switch (entry.op) {
          case 'addText':
            return request('/items', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ kind: 'text', ...data }),
            });
          case 'addImage':
            return request('/items', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ kind: 'image', id: data.id, image: data.image, source: data.source, createdAt: data.createdAt }),
            });
          case 'setPinned':
            return request('/items/' + encodeURIComponent(data.id), {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ pinned: data.pinned === true }),
            });
          case 'removeItem':
            return request('/items/' + encodeURIComponent(data.id), { method: 'DELETE' });
          case 'clear':
            return request('/clear' + (Number(data.before) > 0 ? '?before=' + encodeURIComponent(String(data.before)) : ''), {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: '{}',
            });
          case 'saveSnippet':
            return request('/snippets', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(data),
            });
          case 'removeSnippet':
            return request('/snippets/' + encodeURIComponent(data.id), { method: 'DELETE' });
          case 'mergeSnippets':
            return request('/snippets/import', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ snippets: Array.isArray(data.list) ? data.list : [] }),
            });
          case 'updateSettings':
            return request('/settings', {
              method: 'PUT',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ settings: data.settings }),
            });
          case 'prune':
            return request('/prune', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: '{}',
            });
          default:
            return Promise.resolve();
        }
      }

      async function replayPending() {
        if (replaying || pending.length === 0) return pending.length === 0;
        replaying = true;
        const batch = pending.slice();
        let remaining = [];
        let applied = 0;
        let dropped = 0;
        try {
          for (let index = 0; index < batch.length; index += 1) {
            const entry = batch[index];
            try {
              await sendPending(entry);
              applied += 1;
            } catch (error) {
              const missing = error && error.status === 404;
              const removed = entry.op === 'removeItem' || entry.op === 'removeSnippet';
              if (missing && (removed || entry.op === 'setPinned')) {
                applied += 1;
                continue;
              }
              const retryable = !error
                || !error.status
                || error.status === 401
                || error.status === 403
                || error.status === 429
                || error.status >= 500;
              if (retryable) {
                remaining = batch.slice(index);
                break;
              }
              dropped += 1;
            }
          }
        } finally {
          // Preserve operations enqueued while replay was awaiting the bridge.
          const tail = pending.slice(batch.length);
          pending = remaining.concat(tail);
          persistPending();
          replaying = false;
        }
        if (applied > 0 && pending.length === 0) notifier.push('notice.hostQueueSynced');
        if (dropped > 0) notifier.push('notice.hostQueueDropped', { n: dropped });
        return pending.length === 0;
      }

      async function addText(payload) {
        await request('/items', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'text', ...payload }),
        });
        scheduleRefresh();
      }

      async function addImage(dataUrl, source, id, createdAt) {
        await request('/items', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'image', id, image: dataUrl, source, createdAt }),
        });
        scheduleRefresh();
      }

      async function setPinned(id, pinned) {
        await request('/items/' + encodeURIComponent(id), {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ pinned: pinned === true }),
        });
        scheduleRefresh();
      }

      async function removeItem(id) {
        await request('/items/' + encodeURIComponent(id), { method: 'DELETE' });
        scheduleRefresh();
      }

      async function clearUnpinned(before) {
        const cutoff = Number(before) > 0 ? Number(before) : 0;
        await request('/clear' + (cutoff > 0 ? '?before=' + encodeURIComponent(String(cutoff)) : ''), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        scheduleRefresh();
      }

      async function saveSnippet(payload) {
        await request('/snippets', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        scheduleRefresh();
      }

      async function removeSnippet(id) {
        await request('/snippets/' + encodeURIComponent(id), { method: 'DELETE' });
        scheduleRefresh();
      }

      async function mergeSnippets(list) {
        await request('/snippets/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ snippets: list }),
        });
        scheduleRefresh();
      }

      async function updateSettings(settings) {
        const data = await request('/settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ settings }),
        });
        scheduleRefresh();
        return data;
      }

      async function prune() {
        await request('/prune', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        scheduleRefresh();
      }

      async function setEnabled(enabled) {
        const data = await request('/config', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ enabled: enabled === true }),
        });
        applyStatus(data);
        if (data.enabled === true) {
          const drained = await replayPending();
          if (drained) await refresh(true);
        }
        return data;
      }

      async function tick(force) {
        if (ticking) return;
        ticking = true;
        try {
          await fetchStatus();
          if (!status.supported) return;
          if (!migrationDone) {
            try {
              await ensureMigration();
            } catch (error) {
              notifier.push('notice.hostSyncFailed');
              return;
            }
          }
          const drained = await replayPending();
          if (!drained) return;
          await refresh(force === true);
        } finally {
          ticking = false;
        }
      }

      const onVisible = () => {
        if (document.visibilityState === 'visible') void tick(false);
      };
      const onOnline = () => {
        void tick(true);
      };

      async function start() {
        if (started) return;
        started = true;
        await tick(true);
        timer = setInterval(() => {
          if (document.visibilityState !== 'visible') return;
          void tick(false);
        }, 3000);
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('online', onOnline);
      }

      function stop() {
        if (!started) return;
        started = false;
        if (timer !== null) {
          clearInterval(timer);
          timer = null;
        }
        if (refreshTimer !== null) {
          clearTimeout(refreshTimer);
          refreshTimer = null;
        }
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('online', onOnline);
      }

      if (typeof window !== 'undefined' && window.__ATHAND_TEST_HOOKS__) {
        Object.assign(window.__ATHAND_TEST_HOOKS__, {
          enqueue,
          pending: () => pending.map((entry) => JSON.parse(JSON.stringify(entry))),
          pendingCount: () => pending.length,
          resetPending: () => {
            pending = [];
            queueFullNotified = false;
            persistPending();
          },
          replayPending,
          prepareLegacyPayload,
          migrate,
          hydrateHost: (data) => store.hydrateHost(data),
          addImage: (dataUrl, source) => store.addImage(dataUrl, source),
          updateSettings: (patch) => store.updateSettings(patch),
        });
      }

      return {
        start,
        stop,
        subscribe,
        getStatus,
        setEnabled,
        addText,
        addImage,
        setPinned,
        removeItem,
        clearUnpinned,
        saveSnippet,
        removeSnippet,
        mergeSnippets,
        updateSettings,
        prune,
        enqueue,
        sync: refresh,
      };
    })();

    /* ------------------------------------------------------------------ */
    /* Quick panel bus                                                    */
    /* ------------------------------------------------------------------ */

    const panelBus = (() => {
      let snapshot = { open: false, tab: 'clipboard', insert: null, copyOnly: false, flash: null };
      let flashSerial = 0;
      let flashTimer = null;
      let lastInsert = null;
      let lastFocus = null;
      let lastCapture = null;
      let lastAttach = null;
      const listeners = new Set();
      const emit = () => listeners.forEach((listener) => listener());

      const registerInsert = (fn, focus, capture, attach) => {
        lastInsert = fn;
        lastFocus = typeof focus === 'function' ? focus : null;
        lastCapture = typeof capture === 'function' ? capture : null;
        lastAttach = typeof attach === 'function' ? attach : null;
        return () => {
          if (lastInsert === fn) lastInsert = null;
          if (typeof focus === 'function' && lastFocus === focus) lastFocus = null;
          if (typeof capture === 'function' && lastCapture === capture) lastCapture = null;
          if (typeof attach === 'function' && lastAttach === attach) lastAttach = null;
        };
      };

      const open = (options) => {
        const insert = options && options.insert ? options.insert : lastInsert;
        const capture = options && typeof options.capture === 'function' ? options.capture : lastCapture;
        if (options && typeof options.focus === 'function') lastFocus = options.focus;
        let span = null;
        if (typeof capture === 'function') {
          try {
            span = capture();
          } catch (error) {
            span = null;
          }
        }
        snapshot = {
          ...snapshot,
          open: true,
          tab: options && options.tab ? options.tab : snapshot.tab,
          copyOnly: options && options.copyOnly === true,
          insert,
          span,
        };
        emit();
      };

      const attachImageNow = async (dataUrl) => {
        if (typeof lastAttach !== 'function') return false;
        try {
          return await lastAttach(dataUrl) !== false;
        } catch (error) {
          return false;
        }
      };

      const focusComposerNow = () => {
        const target = lastFocus;
        if (typeof target !== 'function') return false;
        try {
          return target() !== false;
        } catch (error) {
          return false;
        }
      };

      const focusComposer = () => {
        if (typeof lastFocus !== 'function') return false;
        const run = () => {
          try {
            lastFocus();
          } catch (error) {
            /* The composer may have unmounted while the panel was open. */
          }
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
        else setTimeout(run, 0);
        return true;
      };

      const close = (options) => {
        if (!snapshot.open) return;
        snapshot = { ...snapshot, open: false, copyOnly: false, insert: null, span: null };
        emit();
        if (!options || options.restoreFocus !== false) focusComposer();
      };

      const toggle = (options) => {
        if (snapshot.open) close();
        else open(options);
      };

      const setTab = (tab) => {
        if (snapshot.tab === tab) return;
        snapshot = { ...snapshot, tab };
        emit();
      };

      const flash = (key, params) => {
        snapshot = { ...snapshot, flash: { id: ++flashSerial, key, params: params || null } };
        emit();
        if (flashTimer !== null) clearTimeout(flashTimer);
        flashTimer = setTimeout(() => {
          flashTimer = null;
          snapshot = { ...snapshot, flash: null };
          emit();
        }, 1800);
      };

      return {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        open,
        close,
        toggle,
        setTab,
        flash,
        registerInsert,
        attachImageNow,
        focusComposer,
        focusComposerNow,
      };
    })();

    /* ------------------------------------------------------------------ */
    /* Hooks                                                              */
    /* ------------------------------------------------------------------ */

    function useStore() {
      return React.useSyncExternalStore(store.subscribe, store.getSnapshot);
    }

    function usePanel() {
      return React.useSyncExternalStore(panelBus.subscribe, panelBus.getSnapshot);
    }

    function useNotice() {
      return React.useSyncExternalStore(notifier.subscribe, notifier.getSnapshot);
    }

    /* ------------------------------------------------------------------ */
    /* Icons                                                              */
    /* ------------------------------------------------------------------ */

    const GLYPHS = {
      clipboard: [
        'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z',
        'M8 6H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2',
        'M8 11h8M8 15h8M8 19h5',
      ],
      pin: ['M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z'],
      trash: ['M4 7h16', 'M9 7V5h6v2', 'M6 7l1 13h10l1-13', 'M10 11v5M14 11v5'],
      copy: ['M9 9h10v11H9z', 'M15 9V4H5v11h4'],
      search: ['M20 20l-4.4-4.4', 'M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z'],
      plus: ['M12 5v14M5 12h14'],
      close: ['M6 6l12 12M18 6 6 18'],
      image: ['M4 6h16v12H4z', 'M8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z', 'M20 15l-5-5-9 8'],
      text: ['M5 6h14M5 10h14M5 14h10M5 18h7'],
      download: ['M12 4v10', 'M8 10l4 4 4-4', 'M5 19h14'],
      upload: ['M12 20V10', 'M8 14l4-4 4 4', 'M5 5h14'],
      grid: ['M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'],
      list: ['M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01'],
      arrow: ['M9 6l6 6-6 6'],
      check: ['M5 13l4 4L19 7'],
      settings: [
        'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
        'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z',
      ],
    };

    function Glyph(props) {
      const size = props.size || 18;
      const paths = GLYPHS[props.name] || [];
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      }, paths.map((d, index) => h('path', { key: index, d })));
    }

    /* ------------------------------------------------------------------ */
    /* Primitive controls                                                 */
    /* ------------------------------------------------------------------ */

    function Btn(props) {
      const variant = props.variant ? ' bc-btn-' + props.variant : '';
      return h('button', {
        type: 'button',
        className: 'bc-btn' + variant + (props.className ? ' ' + props.className : ''),
        onClick: props.onClick,
        disabled: props.disabled,
        title: props.title,
      }, props.children);
    }

    function IconButton(props) {
      return h('button', {
        type: 'button',
        className: 'bc-iconBtn' + (props.active ? ' is-active' : '') + (props.danger ? ' is-danger' : ''),
        onClick: props.onClick,
        title: props.title,
        'aria-label': props.label,
        'aria-pressed': props.active === undefined ? undefined : String(props.active),
        disabled: props.disabled,
      }, h(Glyph, { name: props.icon, size: props.size || 16 }));
    }

    function Chip(props) {
      return h('button', {
        type: 'button',
        className: 'bc-chip' + (props.active ? ' is-active' : ''),
        onClick: props.onClick,
        'aria-pressed': String(!!props.active),
      }, props.label);
    }

    function Switch(props) {
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': String(!!props.checked),
        className: 'bc-switch' + (props.checked ? ' is-on' : ''),
        onClick: () => props.onChange(!props.checked),
        title: props.title,
      },
        h('span', { className: 'bc-switchTrack', 'aria-hidden': 'true' }, h('span', { className: 'bc-switchThumb' })),
        h('span', { className: 'bc-switchLabel' }, props.label));
    }

    function EmptyState(props) {
      return h('div', { className: 'bc-empty' },
        h('div', { className: 'bc-emptyIcon' }, h(Glyph, { name: props.icon || 'clipboard', size: 26 })),
        h('p', { className: 'bc-emptyTitle' }, props.title),
        h('p', { className: 'bc-emptyBody' }, props.body));
    }

    function Toast(props) {
      const notice = props.notice;
      const t = props.t;
      const [visible, setVisible] = React.useState(false);
      React.useEffect(() => {
        if (!notice) return undefined;
        setVisible(true);
        const timer = setTimeout(() => setVisible(false), 2600);
        return () => clearTimeout(timer);
      }, [notice ? notice.id : 0]);
      if (!notice || !visible) return null;
      return h('div', { className: 'bc-toast', role: 'status', 'aria-live': 'polite' }, t(notice.key, notice.params || undefined));
    }

    function ConfirmDialog(props) {
      const t = props.t;
      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            props.onClose();
          }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, []);
      return h('div', {
        className: 'bc-backdrop',
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) props.onClose();
        },
      }, h('div', { className: 'bc-modal bc-modalSmall', role: 'dialog', 'aria-modal': 'true', 'aria-label': props.message },
        h('p', { className: 'bc-confirmText' }, props.message),
        h('div', { className: 'bc-modalFoot' },
          h(Btn, { variant: 'ghost', onClick: props.onClose }, t('action.cancel')),
          h(Btn, { variant: 'primary', onClick: () => { props.onConfirm(); props.onClose(); } }, t('action.confirm')))));
    }

    function SnippetDialog(props) {
      const t = props.t;
      const draft = props.draft;
      const [title, setTitle] = React.useState(draft.title || '');
      const [content, setContent] = React.useState(draft.content || '');
      const [tag, setTag] = React.useState(draft.tag || '');
      const [error, setError] = React.useState('');
      const contentRef = React.useRef(null);
      React.useEffect(() => {
        if (contentRef.current) contentRef.current.focus();
      }, []);
      const submit = () => {
        if (content.trim() === '') {
          setError(t('editor.error'));
          return;
        }
        props.onSave({ id: draft.id, title, content, tag });
      };
      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          props.onClose();
          return;
        }
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          submit();
        }
      };
      return h('div', {
        className: 'bc-backdrop',
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) props.onClose();
        },
      }, h('div', { className: 'bc-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': draft.id ? t('editor.editTitle') : t('editor.newTitle'), onKeyDown },
        h('h2', { className: 'bc-modalTitle' }, draft.id ? t('editor.editTitle') : t('editor.newTitle')),
        h('label', { className: 'bc-field' },
          h('span', { className: 'bc-fieldLabel' }, t('editor.title')),
          h('input', {
            className: 'bc-input',
            value: title,
            maxLength: 80,
            placeholder: t('editor.titlePlaceholder'),
            onChange: (event) => setTitle(event.target.value),
          })),
        h('label', { className: 'bc-field' },
          h('span', { className: 'bc-fieldLabel' }, t('editor.content')),
          h('textarea', {
            ref: contentRef,
            className: 'bc-textarea',
            value: content,
            rows: 6,
            placeholder: t('editor.contentPlaceholder'),
            onChange: (event) => { setContent(event.target.value); if (error) setError(''); },
          })),
        h('label', { className: 'bc-field' },
          h('span', { className: 'bc-fieldLabel' }, t('editor.tag')),
          h('input', {
            className: 'bc-input',
            value: tag,
            maxLength: 40,
            placeholder: t('editor.tagPlaceholder'),
            onChange: (event) => setTag(event.target.value),
          })),
        error ? h('p', { className: 'bc-fieldError', role: 'alert' }, error) : null,
        h('p', { className: 'bc-hint' }, t('editor.hint')),
        h('div', { className: 'bc-modalFoot' },
          h(Btn, { variant: 'ghost', onClick: props.onClose }, t('action.cancel')),
          h(Btn, { variant: 'primary', onClick: submit }, t('action.save')))));
    }

    function SettingsDialog(props) {
      const t = props.t;
      const settings = props.settings;
      const [shortcut, setShortcut] = React.useState(settings.shortcut);
      const [maxText, setMaxText] = React.useState(String(settings.maxText));
      const [maxImage, setMaxImage] = React.useState(String(settings.maxImage));
      const [maxSnippets, setMaxSnippets] = React.useState(String(settings.maxSnippets));
      const [retentionDays, setRetentionDays] = React.useState(String(settings.retentionDays));
      const firstRef = React.useRef(null);
      const previousRef = React.useRef(null);
      React.useEffect(() => {
        previousRef.current = document.activeElement;
        return () => {
          const previous = previousRef.current;
          if (previous && previous.isConnected && typeof previous.focus === 'function') {
            previous.focus({ preventScroll: true });
          }
        };
      }, []);
      React.useEffect(() => {
        if (firstRef.current) firstRef.current.focus();
      }, []);
      const submit = () => props.onSave({ shortcut, maxText, maxImage, maxSnippets, retentionDays });
      const reset = () => {
        setShortcut(DEFAULT_SETTINGS.shortcut);
        setMaxText(String(DEFAULT_SETTINGS.maxText));
        setMaxImage(String(DEFAULT_SETTINGS.maxImage));
        setMaxSnippets(String(DEFAULT_SETTINGS.maxSnippets));
        setRetentionDays(String(DEFAULT_SETTINGS.retentionDays));
      };
      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          props.onClose();
          return;
        }
        if (event.key === 'Enter' && event.target && event.target.tagName === 'INPUT') {
          event.preventDefault();
          submit();
        }
      };
      const tierField = (key, label, hint, tiers) => {
        const value = key === 'maxText' ? maxText : key === 'maxImage' ? maxImage : maxSnippets;
        const setValue = key === 'maxText' ? setMaxText : key === 'maxImage' ? setMaxImage : setMaxSnippets;
        return h('label', { className: 'bc-field', key },
          h('span', { className: 'bc-fieldLabel' }, label),
          h('select', {
            ref: key === 'maxText' ? firstRef : undefined,
            className: 'bc-input',
            value,
            onChange: (event) => setValue(event.target.value),
          }, tiers.map((tier) => h('option', { key: String(tier), value: String(tier) },
            tier === UNLIMITED_LIMIT
              ? t('settings.tierUnlimited')
              : tier === 0
                ? t('settings.imageOff')
                : t(key === 'maxImage' ? 'settings.tierImages' : 'settings.tierItems', { n: tier })))),
          h('span', { className: 'bc-fieldHint' }, hint));
      };
      const numberField = (key, label, hint, min, max, step) => {
        const value = key === 'maxText' ? maxText : key === 'maxImage' ? maxImage : key === 'maxSnippets' ? maxSnippets : retentionDays;
        const setValue = key === 'maxText' ? setMaxText : key === 'maxImage' ? setMaxImage : key === 'maxSnippets' ? setMaxSnippets : setRetentionDays;
        return h('label', { className: 'bc-field', key },
          h('span', { className: 'bc-fieldLabel' }, label),
          h('input', {
            ref: key === 'maxText' ? firstRef : undefined,
            className: 'bc-input',
            type: 'number',
            min,
            max,
            step,
            value,
            onChange: (event) => setValue(event.target.value),
          }),
          h('span', { className: 'bc-fieldHint' }, hint));
      };
      const usage = props.usage || { text: 0, image: 0, snippets: 0 };
      return h('div', {
        className: 'bc-backdrop',
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) props.onClose();
        },
      }, h('div', {
        className: 'bc-modal bc-modalSettings',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': t('settings.title'),
        onKeyDown,
      },
        h('div', { className: 'bc-modalHead' },
          h('h2', { className: 'bc-modalTitle' }, t('settings.title')),
          h(IconButton, { icon: 'close', label: t('action.close'), title: t('action.close'), onClick: props.onClose })),
        h('p', { className: 'bc-hint' }, t('settings.desc')),
        h('div', { className: 'bc-settingsSection' },
          h('h3', { className: 'bc-settingsTitle' }, t('settings.shortcut')),
          h('label', { className: 'bc-field' },
            h('span', { className: 'bc-fieldLabel' }, t('settings.combo')),
            h('select', {
              className: 'bc-input',
              value: shortcut,
              onChange: (event) => setShortcut(event.target.value),
            }, SHORTCUT_IDS.map((id) => h('option', { key: id, value: id },
              t('settings.shortcut.' + id) + (id === 'off' ? '' : ' · ' + shortcutLabel(id))))),
            h('span', { className: 'bc-fieldHint' }, t('settings.shortcut.hint')))),
        h('div', { className: 'bc-settingsSection' },
          h('h3', { className: 'bc-settingsTitle' }, t('settings.storageSection')),
          h('div', { className: 'bc-settingsGrid' },
            tierField('maxText', t('settings.maxText'), t('settings.maxText.hint'), STORAGE_TIERS),
            tierField('maxImage', t('settings.maxImage'), t('settings.maxImage.hint'), [0, ...STORAGE_TIERS]),
            tierField('maxSnippets', t('settings.maxSnippets'), t('settings.maxSnippets.hint'), STORAGE_TIERS),
            numberField('retentionDays', t('settings.retentionDays'), t('settings.retention.hint'), 0, 365, 1))),
        h('p', { className: 'bc-usage' }, t('settings.usage', usage)),
        h('p', { className: 'bc-hint' }, t('settings.pinned')),
        h('div', { className: 'bc-modalFoot bc-modalFootSplit' },
          h(Btn, { variant: 'ghost', onClick: reset }, t('settings.reset')),
          h('div', { className: 'bc-modalFootRight' },
            h(Btn, { variant: 'ghost', onClick: props.onClose }, t('action.cancel')),
            h(Btn, { variant: 'primary', onClick: submit }, t('action.save'))))));
    }

    /* ------------------------------------------------------------------ */
    /* Page                                                               */
    /* ------------------------------------------------------------------ */

    function ItemCard(props) {
      const item = props.item;
      const t = props.t;
      const layout = props.layout;
      const stop = (event) => event.stopPropagation();
      const pinAction = (event) => { stop(event); props.onTogglePin(item); };
      const deleteAction = (event) => { stop(event); props.onRemove(item); };
      const copyAction = (event) => { stop(event); props.onCopy(item); };
      const body = item.kind === 'image'
        ? h('img', { className: 'bc-thumb', src: item.image, alt: t('kind.image'), loading: 'lazy', draggable: 'false' })
        : h('p', { className: 'bc-itemText' }, item.text);
      return h('article', {
        className: 'bc-item' + (layout === 'list' ? ' is-row' : '') + (item.pinned ? ' is-pinned' : ''),
        onClick: () => props.onCopy(item),
        tabIndex: 0,
        onKeyDown: (event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            props.onCopy(item);
          }
        },
        'aria-label': item.kind === 'image' ? t('kind.image') : item.text.slice(0, 80),
      },
        h('div', { className: 'bc-itemHead' },
          h('span', { className: 'bc-kind' + (item.kind === 'image' ? ' is-image' : '') },
            h(Glyph, { name: item.kind === 'image' ? 'image' : 'text', size: 13 }),
            t(item.kind === 'image' ? 'kind.image' : 'kind.text')),
          h('span', { className: 'bc-meta' }, timeLabel(item.createdAt, t)),
          h('span', { className: 'bc-meta' }, t('source.' + (item.source || 'manual')))),
        h('div', { className: 'bc-itemBody' }, body),
        h('div', { className: 'bc-itemFoot' },
          h('span', { className: 'bc-meta' }, item.kind === 'image' ? '' : t('meta.chars', { n: item.text.length })),
          h('div', { className: 'bc-itemActions' },
            h(IconButton, { icon: 'pin', label: item.pinned ? t('action.unpin') : t('action.pin'), title: item.pinned ? t('action.unpin') : t('action.pin'), active: item.pinned, onClick: pinAction }),
            h(IconButton, { icon: 'copy', label: t('action.copy'), title: t('action.copy'), onClick: copyAction }),
            h(IconButton, { icon: 'trash', label: t('action.delete'), title: t('action.delete'), danger: true, onClick: deleteAction }))));
    }

    function SnippetCard(props) {
      const snippet = props.snippet;
      const t = props.t;
      return h('article', { className: 'bc-snippet' },
        h('div', { className: 'bc-snippetHead' },
          h('h3', { className: 'bc-snippetTitle' }, snippet.title),
          snippet.tag ? h('span', { className: 'bc-tag' }, snippet.tag) : null),
        h('p', { className: 'bc-snippetBody' }, snippet.content),
        h('div', { className: 'bc-snippetFoot' },
          h('span', { className: 'bc-meta' }, timeLabel(snippet.updatedAt, t)),
          h('div', { className: 'bc-itemActions' },
            h(IconButton, { icon: 'copy', label: t('action.copy'), title: t('action.copy'), onClick: () => props.onCopy(snippet) }),
            h(IconButton, { icon: 'text', label: t('action.edit'), title: t('action.edit'), onClick: () => props.onEdit(snippet) }),
            h(IconButton, { icon: 'trash', label: t('action.delete'), title: t('action.delete'), danger: true, onClick: () => props.onDelete(snippet) }))));
    }

    function matchesQuery(text, query) {
      if (query === '') return true;
      return String(text || '').toLowerCase().includes(query);
    }

    function ClipboardPage(props) {
      const t = props.t || fallbackT;
      const state = useStore();
      const notice = useNotice();
      const host = React.useSyncExternalStore(hostBridge.subscribe, hostBridge.getStatus);
      const [tab, setTab] = React.useState('clipboard');
      const [query, setQuery] = React.useState('');
      const [filter, setFilter] = React.useState('all');
      const [tagFilter, setTagFilter] = React.useState('');
      const [draft, setDraft] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [confirm, setConfirm] = React.useState(null);
      const [settingsOpen, setSettingsOpen] = React.useState(false);

      const queryText = query.trim().toLowerCase();

      const clipboardRows = state.items
        .filter((item) => {
          if (filter === 'text' && item.kind !== 'text') return false;
          if (filter === 'image' && item.kind !== 'image') return false;
          if (filter === 'pinned' && !item.pinned) return false;
          return matchesQuery(item.kind === 'image' ? t('kind.image') : item.text, queryText);
        })
        .slice()
        .sort((left, right) => (Number(right.pinned) - Number(left.pinned)) || (right.createdAt - left.createdAt));

      const tags = Array.from(new Set(state.snippets.map((snippet) => snippet.tag).filter(Boolean))).slice(0, 12);
      const snippetRows = state.snippets
        .filter((snippet) => (tagFilter === '' || snippet.tag === tagFilter)
          && matchesQuery(snippet.title + '\n' + snippet.content + '\n' + snippet.tag, queryText))
        .slice()
        .sort((left, right) => right.updatedAt - left.updatedAt);

      const imageCount = clipboardRows.filter((item) => item.kind === 'image').length;

      const handleCopyItem = async (item) => {
        const ok = item.kind === 'image' ? await copyImage(item.image) : await copyText(item.text);
        notifier.push(ok ? 'notice.copied' : 'notice.copyFailed');
      };

      const handleCopySnippet = async (snippet) => {
        const ok = await copyText(snippet.content);
        notifier.push(ok ? 'notice.copied' : 'notice.copyFailed');
      };

      const handleSaveSettings = (value) => {
        setSettingsOpen(false);
        void store.updateSettings(value).then((result) => {
          if (result.queued) {
            notifier.push('notice.settingsSaved');
            return;
          }
          notifier.push(result.removed > 0 ? 'notice.settingsSavedPruned' : 'notice.settingsSaved', { n: result.removed });
        }).catch(() => {
          notifier.push('notice.hostSyncFailed');
        });
      };

      const handleRead = async () => {
        if (busy) return;
        setBusy(true);
        try {
          const result = await readClipboardNow();
          if (!result.text && result.images === 0) notifier.push('notice.readEmpty');
        } catch (error) {
          notifier.push('notice.readFailed', { message: error && error.message ? error.message : String(error) });
        } finally {
          setBusy(false);
        }
      };

      const handleHostWatch = async (next) => {
        if (next && (!host.supported || !host.watchSupported)) {
          notifier.push('hostWatch.unsupported');
          return;
        }
        try {
          const result = await hostBridge.setEnabled(next);
          if (next && (!result || result.enabled !== true)) notifier.push('hostWatch.failed');
          else notifier.push(result && result.enabled ? 'hostWatch.enabled' : 'hostWatch.disabled');
        } catch (error) {
          notifier.push('hostWatch.failed');
        }
      };

      const handleSaveSnippet = (value) => {
        if (store.saveSnippet(value)) {
          setDraft(null);
          notifier.push('notice.saved');
        }
      };

      const handleImport = async (file) => {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          const list = Array.isArray(data) ? data : data && Array.isArray(data.snippets) ? data.snippets : null;
          if (!list) throw new Error('JSON');
          const added = store.mergeSnippets(list);
          notifier.push('notice.imported', { n: added });
        } catch (error) {
          notifier.push('notice.importFailed', { message: error && error.message ? error.message : String(error) });
        }
      };

      const handleExport = () => {
        if (state.snippets.length === 0) {
          notifier.push('notice.exported', { n: 0 });
          return;
        }
        const payload = {
          format: 'athand/snippets',
          version: 1,
          exportedAt: new Date().toISOString(),
          snippets: state.snippets,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'athand-snippets-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        notifier.push('notice.exported', { n: state.snippets.length });
      };

      const tabButton = (id, label) => h('button', {
        type: 'button',
        role: 'tab',
        'aria-selected': String(tab === id),
        className: 'bc-tab' + (tab === id ? ' is-active' : ''),
        onClick: () => { setTab(id); setQuery(''); },
      }, label);

      return h('section', { className: 'bc-page', 'aria-label': t('page.title') },
        h('header', { className: 'bc-head' },
          h('div', { className: 'bc-headText' },
            h('h1', { className: 'bc-title' }, t('page.title')),
            h('p', { className: 'bc-sub' }, t('page.subtitle'))),
          h('div', { className: 'bc-headActions' },
            tab === 'clipboard'
              ? h(Btn, { key: 'read', onClick: handleRead, disabled: busy }, busy ? t('action.reading') : t('action.read'))
              : [
                h(Btn, { key: 'new', variant: 'primary', onClick: () => setDraft({ title: '', content: '', tag: '' }) }, t('action.new')),
                h(Btn, { key: 'export', onClick: handleExport }, t('action.export')),
                h('label', { key: 'import', className: 'bc-btn' },
                  t('action.import'),
                  h('input', {
                    type: 'file',
                    accept: '.json,application/json',
                    className: 'bc-file',
                    onChange: (event) => {
                      const file = event.target.files && event.target.files[0];
                      event.target.value = '';
                      if (file) void handleImport(file);
                    },
                  })),
              ],
            h(IconButton, {
              key: 'settings',
              icon: 'settings',
              label: t('settings.open'),
              title: t('settings.open'),
              onClick: () => setSettingsOpen(true),
            }))),

        h('div', { className: 'bc-tabs', role: 'tablist' },
          tabButton('clipboard', t('tab.clipboard')),
          tabButton('snippets', t('tab.snippets'))),

        tab === 'clipboard'
          ? h('div', { className: 'bc-body' },
            h('div', { className: 'bc-toolbar' },
              h('div', { className: 'bc-searchWrap' },
                h(Glyph, { name: 'search', size: 15 }),
                h('input', {
                  className: 'bc-search',
                  value: query,
                  placeholder: t('clipboard.search'),
                  'aria-label': t('clipboard.search'),
                  onChange: (event) => setQuery(event.target.value),
                })),
              h('div', { className: 'bc-chips' },
                h(Chip, { label: t('filter.all'), active: filter === 'all', onClick: () => setFilter('all') }),
                h(Chip, { label: t('filter.text'), active: filter === 'text', onClick: () => setFilter('text') }),
                h(Chip, { label: t('filter.image'), active: filter === 'image', onClick: () => setFilter('image') }),
                h(Chip, { label: t('filter.pinned'), active: filter === 'pinned', onClick: () => setFilter('pinned') })),
              h('div', { className: 'bc-toolbarEnd' },
                h(Switch, {
                  checked: host.enabled,
                  onChange: handleHostWatch,
                  label: t('hostWatch'),
                  title: host.supported && host.watchSupported ? t('hostWatch.help') : t('hostWatch.unsupported'),
                }),
                h(IconButton, {
                  icon: state.settings.layout === 'cards' ? 'list' : 'grid',
                  label: state.settings.layout === 'cards' ? t('layout.list') : t('layout.cards'),
                  title: state.settings.layout === 'cards' ? t('layout.list') : t('layout.cards'),
                  onClick: () => store.setLayout(state.settings.layout === 'cards' ? 'list' : 'cards'),
                }),
                h(Btn, {
                  variant: 'ghost',
                  onClick: () => setConfirm({ message: t('confirm.clear'), run: () => { store.clearUnpinned(); notifier.push('notice.cleared'); } }),
                }, t('action.clear')))),
            clipboardRows.length === 0
              ? h(EmptyState, {
                icon: 'clipboard',
                title: queryText === '' && filter === 'all' ? t('empty.clipboard.title') : t('empty.search'),
                body: queryText === '' && filter === 'all' ? t('empty.clipboard.body') : '',
              })
              : h('div', { className: 'bc-items ' + (state.settings.layout === 'cards' ? 'is-cards' : 'is-list') },
                clipboardRows.map((item) => h(ItemCard, {
                  key: item.id,
                  item,
                  t,
                  layout: state.settings.layout,
                  onCopy: handleCopyItem,
                  onTogglePin: (target) => store.togglePin(target.id),
                  onRemove: (target) => store.removeItem(target.id),
                }))),
            h('p', { className: 'bc-count' },
              t('footer.count', { n: clipboardRows.length }),
              imageCount > 0 ? ' · ' + t('footer.images', { n: imageCount }) : ''))
          : h('div', { className: 'bc-body' },
            h('div', { className: 'bc-toolbar' },
              h('div', { className: 'bc-searchWrap' },
                h(Glyph, { name: 'search', size: 15 }),
                h('input', {
                  className: 'bc-search',
                  value: query,
                  placeholder: t('snippets.search'),
                  'aria-label': t('snippets.search'),
                  onChange: (event) => setQuery(event.target.value),
                })),
              tags.length > 0
                ? h('div', { className: 'bc-chips' },
                  h(Chip, { label: t('filter.all'), active: tagFilter === '', onClick: () => setTagFilter('') }),
                  tags.map((tag) => h(Chip, { key: tag, label: tag, active: tagFilter === tag, onClick: () => setTagFilter(tagFilter === tag ? '' : tag) })))
                : null,
              h('div', { className: 'bc-toolbarEnd' },
                h('span', { className: 'bc-meta' }, t('footer.count', { n: snippetRows.length })))),
            snippetRows.length === 0
              ? h(EmptyState, {
                icon: 'text',
                title: queryText === '' ? t('empty.snippets.title') : t('empty.search'),
                body: queryText === '' ? t('empty.snippets.body') : '',
              })
              : h('div', { className: 'bc-snippets' },
                snippetRows.map((snippet) => h(SnippetCard, {
                  key: snippet.id,
                  snippet,
                  t,
                  onCopy: handleCopySnippet,
                  onEdit: (target) => setDraft({ id: target.id, title: target.title, content: target.content, tag: target.tag }),
                  onDelete: (target) => setConfirm({
                    message: t('confirm.deleteSnippet'),
                    run: () => store.removeSnippet(target.id),
                  }),
                })))),

        draft ? h(SnippetDialog, {
          draft,
          t,
          onClose: () => setDraft(null),
          onSave: handleSaveSnippet,
        }) : null,
        confirm ? h(ConfirmDialog, {
          message: confirm.message,
          t,
          onClose: () => setConfirm(null),
          onConfirm: confirm.run,
        }) : null,
        settingsOpen ? h(SettingsDialog, {
          settings: state.settings,
          usage: {
            text: state.items.filter((item) => item.kind === 'text').length,
            image: state.items.filter((item) => item.kind === 'image').length,
            snippets: state.snippets.length,
          },
          t,
          onClose: () => setSettingsOpen(false),
          onSave: handleSaveSettings,
        }) : null,
        h(Toast, { notice, t }));
    }

    /* ------------------------------------------------------------------ */
    /* Quick panel                                                        */
    /* ------------------------------------------------------------------ */

    function QuickPanel(props) {
      const t = props.t || fallbackT;
      const state = useStore();
      const panel = usePanel();
      const notice = useNotice();
      const [query, setQuery] = React.useState('');
      const [cursor, setCursor] = React.useState(0);
      const searchRef = React.useRef(null);
      const listRef = React.useRef(null);

      React.useEffect(() => {
        const onCopy = () => {
          try {
            const text = window.getSelection ? String(window.getSelection() || '') : '';
            if (text.trim() !== '') store.addText(text, 'copy');
          } catch (error) {
            /* Selection may be unavailable in some frames. */
          }
        };
        const onCut = () => {
          try {
            const text = window.getSelection ? String(window.getSelection() || '') : '';
            if (text.trim() !== '') store.addText(text, 'cut');
          } catch (error) {
            /* ignore */
          }
        };
        const onPaste = (event) => {
          const data = event.clipboardData;
          if (!data) return;
          try {
            const text = data.getData('text/plain');
            if (text && text.trim() !== '') store.addText(text, 'paste');
          } catch (error) {
            /* ignore */
          }
          try {
            const files = [];
            if (data.items) {
              for (const item of data.items) {
                if (item.kind === 'file' && item.type && item.type.startsWith('image/')) {
                  const file = item.getAsFile();
                  if (file) files.push(file);
                }
              }
            }
            files.forEach((file) => { void addImageBlob(file, 'paste'); });
          } catch (error) {
            /* ignore */
          }
        };
        const onKeyDown = (event) => {
          const shortcut = store.getSnapshot().settings.shortcut;
          if (shortcutMatches(event, shortcut)) {
            event.preventDefault();
            if (!event.repeat) panelBus.toggle();
            return;
          }
          if (event.key === 'Escape' && panelBus.getSnapshot().open) {
            event.preventDefault();
            panelBus.close();
          }
        };
        const summonFromHash = () => {
          let hash = '';
          try {
            hash = String(window.location.hash || '');
          } catch (error) {
            return;
          }
          if (hash !== '#bc-summon' && hash !== '#athand-summon') return;
          try {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          } catch (error) {
            /* Clearing the hash is cosmetic; the panel still opens. */
          }
          panelBus.open({ tab: 'clipboard', copyOnly: true });
        };
        document.addEventListener('copy', onCopy, true);
        document.addEventListener('cut', onCut, true);
        document.addEventListener('paste', onPaste, true);
        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('hashchange', summonFromHash);
        summonFromHash();
        const retentionTimer = setInterval(() => { store.pruneExpired(); }, 30 * 60 * 1000);
        return () => {
          document.removeEventListener('copy', onCopy, true);
          document.removeEventListener('cut', onCut, true);
          document.removeEventListener('paste', onPaste, true);
          window.removeEventListener('keydown', onKeyDown, true);
          window.removeEventListener('hashchange', summonFromHash);
          clearInterval(retentionTimer);
        };
      }, []);

      React.useEffect(() => {
        if (!panel.open) return undefined;
        setQuery('');
        setCursor(0);
        const timer = setTimeout(() => {
          if (searchRef.current) searchRef.current.focus();
        }, 30);
        return () => clearTimeout(timer);
      }, [panel.open]);

      const queryText = query.trim().toLowerCase();
      const clipRows = state.items
        .filter((item) => matchesQuery(item.kind === 'image' ? t('kind.image') : item.text, queryText))
        .slice()
        .sort((left, right) => (Number(right.pinned) - Number(left.pinned)) || (right.createdAt - left.createdAt))
        .slice(0, 20);
      const snippetRows = state.snippets
        .filter((snippet) => matchesQuery(snippet.title + '\n' + snippet.content + '\n' + snippet.tag, queryText))
        .slice()
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 20);
      const rows = panel.tab === 'snippets'
        ? snippetRows.map((snippet) => ({ id: snippet.id, kind: 'snippet', title: snippet.title, text: snippet.content, tag: snippet.tag }))
        : clipRows.map((item) => ({ id: item.id, kind: item.kind, title: item.kind === 'image' ? t('kind.image') : item.text, text: item.text, image: item.image, source: item.source, createdAt: item.createdAt, pinned: item.pinned }));

      const active = clamp(cursor, 0, Math.max(0, rows.length - 1));

      const tryInsert = (text) => {
        if (typeof panel.insert !== 'function') return false;
        try {
          return panel.insert(text, panel.span) !== false;
        } catch (error) {
          return false;
        }
      };

      const runRow = async (row) => {
        if (!row) return;
        if (panel.copyOnly) {
          const ok = row.kind === 'image' ? await copyImage(row.image) : await copyText(row.text);
          panelBus.flash(ok ? 'notice.copied' : 'notice.copyFailed');
          if (ok) panelBus.close({ restoreFocus: false });
          return;
        }
        if (row.kind === 'image') {
          const attached = await panelBus.attachImageNow(row.image);
          if (attached) {
            panelBus.flash('notice.attached');
            panelBus.close();
            return;
          }
          const ok = await copyImage(row.image);
          panelBus.flash(ok ? 'notice.copied' : 'notice.copyFailed');
          if (ok) panelBus.close();
          return;
        }
        const text = row.text;
        // Focus before editing so Lexical leaves the caret after the inserted text.
        const focused = panelBus.focusComposerNow();
        const closeOptions = { restoreFocus: !focused };
        if (tryInsert(text)) {
          panelBus.flash('notice.inserted');
          panelBus.close(closeOptions);
          return;
        }
        const ok = await copyText(text);
        panelBus.flash(ok ? 'notice.copied' : 'notice.copyFailed');
        if (ok) panelBus.close(closeOptions);
      };

      const onPanelKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          panelBus.close();
          return;
        }
        const target = event.target;
        if (target !== searchRef.current && target !== event.currentTarget) return;
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setCursor((value) => clamp(value + 1, 0, Math.max(0, rows.length - 1)));
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setCursor((value) => clamp(value - 1, 0, Math.max(0, rows.length - 1)));
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          const row = rows[active];
          if (row) void runRow(row);
        }
      };

      if (!panel.open) {
        return h(React.Fragment, null,
          panel.flash ? h('div', { className: 'bc-toast', role: 'status' }, t(panel.flash.key, panel.flash.params || undefined)) : null,
          notice ? h(Toast, { notice, t }) : null);
      }

      return h(React.Fragment, null,
        h('div', { className: 'bc-backdrop bc-quickBackdrop', onMouseDown: () => panelBus.close() }),
        h('div', {
          className: 'bc-quick',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': t('quick.title'),
          onKeyDown: onPanelKeyDown,
        },
          h('div', { className: 'bc-quickHead' },
            h('div', { className: 'bc-quickTabs', role: 'tablist' },
              h('button', {
                type: 'button',
                role: 'tab',
                'aria-selected': String(panel.tab === 'clipboard'),
                className: 'bc-quickTab' + (panel.tab === 'clipboard' ? ' is-active' : ''),
                onClick: () => { panelBus.setTab('clipboard'); setCursor(0); },
              }, t('quick.clipboard')),
              h('button', {
                type: 'button',
                role: 'tab',
                'aria-selected': String(panel.tab === 'snippets'),
                className: 'bc-quickTab' + (panel.tab === 'snippets' ? ' is-active' : ''),
                onClick: () => { panelBus.setTab('snippets'); setCursor(0); },
              }, t('quick.snippets'))),
            h(IconButton, { icon: 'close', label: t('action.close'), title: t('action.close'), onClick: () => panelBus.close() })),
          h('div', { className: 'bc-quickSearchWrap' },
            h(Glyph, { name: 'search', size: 16 }),
            h('input', {
              ref: searchRef,
              className: 'bc-quickSearch',
              value: query,
              placeholder: panel.tab === 'snippets' ? t('snippets.search') : t('clipboard.search'),
              'aria-label': panel.tab === 'snippets' ? t('snippets.search') : t('clipboard.search'),
              onChange: (event) => { setQuery(event.target.value); setCursor(0); },
            })),
          h('div', { className: 'bc-quickList', ref: listRef, role: 'listbox', 'aria-label': t('quick.title') },
            rows.length === 0
              ? h('p', { className: 'bc-quickEmpty' }, t('empty.search'))
              : rows.map((row, index) => h('button', {
                key: row.id,
                type: 'button',
                role: 'option',
                'aria-selected': String(index === active),
                className: 'bc-quickRow' + (index === active ? ' is-active' : ''),
                onMouseEnter: () => setCursor(index),
                onClick: () => { setCursor(index); void runRow(row); },
              },
                row.kind === 'image'
                  ? h('span', { className: 'bc-quickThumbWrap' },
                    h('img', {
                      className: 'bc-quickThumb',
                      src: row.image,
                      alt: t('kind.image'),
                      title: t('kind.image'),
                      loading: 'lazy',
                      draggable: 'false',
                    }))
                  : h('span', { className: 'bc-quickKind' }, h(Glyph, { name: row.kind === 'snippet' ? 'text' : 'clipboard', size: 15 })),
                h('span', { className: 'bc-quickBody' },
                  h('span', { className: 'bc-quickTitle' }, row.title),
                  row.kind === 'snippet'
                    ? h('span', { className: 'bc-quickMeta' }, row.tag || t('tab.snippets'))
                    : h('span', { className: 'bc-quickMeta' },
                      timeLabel(row.createdAt, t),
                      row.pinned ? ' · ' + t('filter.pinned') : '')),
                h('span', { className: 'bc-quickAction' }, h(Glyph, { name: 'arrow', size: 14 }))))),
          h('div', { className: 'bc-quickFoot' },
            h('span', { className: 'bc-quickHint' }, panel.copyOnly
              ? t('quick.hint.copy')
              : state.settings.shortcut === 'off'
                ? t('quick.hint.off')
                : t('quick.hint', { shortcut: shortcutLabel(state.settings.shortcut) })),
            h(Btn, { variant: 'ghost', onClick: () => { panelBus.close(); if (typeof props.onOpenPanel === 'function') props.onOpenPanel(); } }, t('action.openPanel'))),
          panel.flash ? h('div', { className: 'bc-quickFlash', role: 'status' }, t(panel.flash.key, panel.flash.params || undefined)) : null),
        notice ? h(Toast, { notice, t }) : null);
    }

    /* ------------------------------------------------------------------ */
    /* Composer entry                                                     */
    /* ------------------------------------------------------------------ */

    function focusComposer(sessionId) {
      const ctx = hostContext;
      if (ctx && typeof ctx.get === 'function') {
        try {
          const sessions = ctx.get('sessions');
          const actx = sessions && sessionId !== undefined ? sessions.scope(sessionId) : undefined;
          const conversation = actx ? actx.get('conversation') : undefined;
          const input = conversation && conversation.input ? conversation.input : undefined;
          if (input && actx) {
            let shell;
            if (typeof input.for === 'function') {
              try {
                shell = input.for(actx);
              } catch (error) {
                shell = undefined;
              }
            }
            if (!shell && typeof input.shellFor === 'function') {
              let binding;
              try {
                binding = sessions && typeof sessions.binding === 'function' ? sessions.binding(sessionId) : undefined;
              } catch (error) {
                binding = undefined;
              }
              if (binding) shell = input.shellFor(binding);
            }
            if (shell && typeof shell.focus === 'function') {
              shell.focus();
              return true;
            }
          }
        } catch (error) {
          /* Fall back to the DOM when the input shell is unavailable. */
        }
      }
      try {
        const input = document.querySelector('[data-composer-input]');
        if (!input || typeof input.focus !== 'function') return false;
        input.focus({ preventScroll: true });
        const selection = window.getSelection ? window.getSelection() : null;
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(input);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        return true;
      } catch (error) {
        return false;
      }
    }

    function ComposerButton(props) {
      const t = props.t || fallbackT;
      const actionsRef = React.useRef(props.inputActions);
      actionsRef.current = props.inputActions;
      const sessionRef = React.useRef(props.sessionId);
      sessionRef.current = props.sessionId;
      const insert = React.useCallback((text, span) => {
        const actions = actionsRef.current;
        if (!actions || typeof actions.insertText !== 'function' || typeof actions.captureInsertion !== 'function') return false;
        try {
          return actions.insertText(text, span || actions.captureInsertion());
        } catch (error) {
          return false;
        }
      }, []);
      const capture = React.useCallback(() => {
        const actions = actionsRef.current;
        if (!actions || typeof actions.captureInsertion !== 'function') return null;
        try {
          return actions.captureInsertion();
        } catch (error) {
          return null;
        }
      }, []);
      const attachImage = React.useCallback(async (dataUrl) => {
        const actions = actionsRef.current;
        const sessionId = sessionRef.current;
        if (!actions || typeof actions.addAttachments !== 'function' || sessionId === undefined) return false;
        const ctx = hostContext;
        if (!ctx || typeof ctx.get !== 'function') return false;
        const file = await imageFileFromDataUrl(dataUrl);
        if (!file) return false;
        // createDrafts lives on the root Conversation service and takes an explicit session id.
        const conversation = typeof ctx.get === 'function' ? ctx.get('conversation') : undefined;
        if (!conversation || typeof conversation.createDrafts !== 'function') return false;
        let drafts;
        try {
          drafts = conversation.createDrafts(sessionId, [file]);
        } catch (error) {
          return false;
        }
        if (!Array.isArray(drafts) || drafts.length === 0) return false;
        const ids = drafts.map((draft) => draft && draft.id).filter(Boolean);
        if (ids.length !== drafts.length) {
          if (typeof conversation.releaseDraftAttachments === 'function') {
            try { conversation.releaseDraftAttachments(drafts); } catch (error) { /* best effort */ }
          }
          return false;
        }
        let attached = false;
        try {
          attached = actions.addAttachments(ids) !== false;
        } catch (error) {
          attached = false;
        }
        if (!attached) {
          if (typeof conversation.releaseDraftAttachments === 'function') {
            try { conversation.releaseDraftAttachments(drafts); } catch (error) { /* best effort */ }
          }
          return false;
        }
        return true;
      }, []);
      const focus = React.useCallback(() => focusComposer(sessionRef.current), []);
      React.useEffect(() => panelBus.registerInsert(insert, focus, capture, attachImage), [insert, focus, capture, attachImage]);
      const disabled = props.locked === true || !props.inputActions;
      const shortcut = React.useSyncExternalStore(store.subscribe, () => store.getSnapshot().settings.shortcut);
      const openTitle = shortcut === 'off'
        ? t('composer.openOff')
        : t('composer.open', { shortcut: shortcutLabel(shortcut) });
      return h('button', {
        type: 'button',
        className: 'bc-composerBtn',
        title: openTitle,
        'aria-label': openTitle,
        'aria-haspopup': 'dialog',
        disabled,
        onMouseDown: (event) => event.preventDefault(),
        onClick: () => panelBus.open({ insert, focus, capture }),
      }, h(Glyph, { name: 'clipboard', size: 17 }));
    }

    function PanelIcon(props) {
      const size = props && props.size ? props.size : 18;
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      },
        h('path', { d: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z' }),
        h('path', { d: 'M8 6H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2' }),
        h('path', { d: 'M8 11h8M8 15h8M8 19h5' }));
    }

    /* ------------------------------------------------------------------ */
    /* Styles                                                             */
    /* ------------------------------------------------------------------ */

    const CSS = `
.bc-page {
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
  padding: 26px 30px 60px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.55;
}
.bc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  max-width: 1080px;
  margin: 0 auto 18px;
}
.bc-title { margin: 0 0 4px; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
.bc-sub { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 12.5px; }
.bc-headActions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.bc-tabs {
  display: flex;
  gap: 2px;
  max-width: 1080px;
  margin: 0 auto 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.bc-tab {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 13px;
  padding: 8px 12px 9px;
  margin-bottom: -1px;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}
.bc-tab:hover { color: var(--dsw-alias-label-primary); }
.bc-tab.is-active { color: var(--dsw-alias-label-primary); border-bottom-color: var(--dsw-alias-brand-primary); font-weight: 600; }
.bc-body { max-width: 1080px; margin: 0 auto; }
.bc-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}
.bc-searchWrap {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: 1 1 220px;
  min-width: 180px;
  max-width: 380px;
  padding: 0 10px;
  height: 32px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
}
.bc-searchWrap:focus-within { border-color: var(--dsw-alias-brand-primary); }
.bc-search {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
}
.bc-search::placeholder { color: var(--dsw-alias-label-secondary); }
.bc-chips { display: flex; align-items: center; gap: 4px; }
.bc-chip {
  appearance: none;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  padding: 4px 9px;
  border-radius: 999px;
  cursor: pointer;
}
.bc-chip:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.bc-chip.is-active { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.bc-toolbarEnd { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-left: auto; }
.bc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}
.bc-btn:hover { background: var(--dsw-alias-bg-layer-2); }
.bc-btn:disabled { opacity: 0.5; cursor: default; }
.bc-btn-primary { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.bc-btn-ghost { border-color: transparent; color: var(--dsw-alias-label-secondary); }
.bc-btn-ghost:hover { color: var(--dsw-alias-label-primary); }
.bc-file { display: none; }
.bc-iconBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: none;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.bc-iconBtn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.bc-iconBtn.is-active { color: var(--dsw-alias-brand-primary); }
.bc-iconBtn.is-danger:hover { color: var(--dsw-alias-state-error-primary); }
.bc-switch {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  padding: 2px 4px;
  cursor: pointer;
}
.bc-switchTrack {
  position: relative;
  width: 28px;
  height: 16px;
  flex: none;
  border-radius: 999px;
  background: var(--dsw-alias-border-l2);
  transition: background 120ms ease;
}
.bc-switchThumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--dsw-alias-bg-layer-1);
  transition: transform 120ms ease;
}
.bc-switch.is-on .bc-switchTrack { background: var(--dsw-alias-brand-primary); }
.bc-switch.is-on .bc-switchThumb { transform: translateX(12px); }
.bc-switch.is-on .bc-switchLabel { color: var(--dsw-alias-label-primary); }
.bc-items.is-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; }
.bc-items.is-list { display: flex; flex-direction: column; gap: 8px; }
.bc-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 11px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  cursor: pointer;
  outline: none;
  min-width: 0;
}
.bc-item:hover { border-color: var(--dsw-alias-border-l2); }
.bc-item:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.bc-item.is-pinned { border-color: var(--dsw-alias-brand-primary); }
.bc-itemHead { display: flex; align-items: center; gap: 8px; color: var(--dsw-alias-label-secondary); }
.bc-kind {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-2);
}
.bc-kind.is-image { color: var(--dsw-alias-brand-primary); }
.bc-meta { color: var(--dsw-alias-label-secondary); font-size: 11.5px; }
.bc-kind + .bc-meta { margin-left: auto; }
.bc-itemBody { min-width: 0; }
.bc-itemText {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 12.5px;
  line-height: 1.5;
}
.bc-thumb {
  display: block;
  width: 100%;
  max-height: 170px;
  object-fit: contain;
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2);
}
.bc-itemFoot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; }
.bc-itemActions { display: flex; align-items: center; gap: 1px; }
.bc-item.is-row { flex-direction: row; align-items: center; gap: 12px; }
.bc-item.is-row .bc-itemHead { flex-direction: column; align-items: flex-start; gap: 2px; width: 92px; flex: none; }
.bc-item.is-row .bc-kind + .bc-meta { margin-left: 0; }
.bc-item.is-row .bc-itemBody { flex: 1; }
.bc-item.is-row .bc-itemFoot { margin: 0; flex: none; }
.bc-item.is-row .bc-itemFoot .bc-meta { display: none; }
.bc-item.is-row .bc-thumb { width: 120px; max-height: 68px; }
.bc-snippets { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 10px; }
.bc-snippet {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  min-width: 0;
}
.bc-snippetHead { display: flex; align-items: center; gap: 8px; }
.bc-snippetTitle { margin: 0; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bc-tag {
  flex: none;
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
}
.bc-snippetBody {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-size: 12.5px;
  line-height: 1.5;
}
.bc-snippetFoot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; }
.bc-count { margin: 14px 2px 0; color: var(--dsw-alias-label-secondary); font-size: 11.5px; }
.bc-empty { text-align: center; padding: 68px 16px; border: 1px dashed var(--dsw-alias-border-l1); border-radius: 12px; }
.bc-emptyIcon { display: inline-flex; color: var(--dsw-alias-label-secondary); margin-bottom: 6px; }
.bc-emptyTitle { margin: 0 0 4px; font-weight: 600; }
.bc-emptyBody { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 12.5px; }
.bc-backdrop {
  pointer-events: auto;
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.28);
  padding: 24px;
}
.bc-modal {
  width: min(520px, 100%);
  max-height: min(80vh, 640px);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border-radius: 14px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
}
.bc-modalSmall { width: min(380px, 100%); }
.bc-modalSettings { width: min(620px, 100%); box-sizing: border-box; }
.bc-modalHead { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.bc-modalTitle { margin: 0 0 2px; font-size: 15px; font-weight: 600; }
.bc-settingsSection { display: flex; flex-direction: column; gap: 8px; }
.bc-settingsSection + .bc-settingsSection { border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 12px; }
.bc-settingsTitle { margin: 0; font-size: 12px; font-weight: 600; }
.bc-settingsGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.bc-fieldHint { font-size: 11px; line-height: 1.45; color: var(--dsw-alias-label-secondary); }
.bc-usage {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font-size: 11.5px;
}
select.bc-input { height: 32px; padding: 0 8px; }
@media (max-width: 560px) {
  .bc-settingsGrid { grid-template-columns: 1fr; }
}
.bc-confirmText { margin: 2px 0 8px; font-size: 13px; }
.bc-field { display: flex; flex-direction: column; gap: 4px; }
.bc-fieldLabel { font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.bc-input, .bc-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
  padding: 7px 9px;
  outline: none;
}
.bc-input:focus, .bc-textarea:focus { border-color: var(--dsw-alias-brand-primary); }
.bc-textarea { resize: vertical; min-height: 110px; line-height: 1.55; }
.bc-fieldError { margin: 0; color: var(--dsw-alias-state-error-primary); font-size: 12px; }
.bc-hint { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 11.5px; }
.bc-modalFoot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.bc-modalFootSplit { justify-content: space-between; align-items: center; }
.bc-modalFootRight { display: flex; gap: 8px; }
.bc-toast {
  position: fixed;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  z-index: 90;
  padding: 8px 14px;
  border-radius: 9px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  font-size: 12.5px;
  pointer-events: none;
}
.bc-composerBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: none;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  padding: 0;
}
.bc-composerBtn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.bc-composerBtn:disabled { opacity: 0.45; cursor: default; background: transparent; }
.bc-quickBackdrop { background: transparent; align-items: flex-end; padding: 0; }
.bc-quick {
  pointer-events: auto;
  position: fixed;
  left: 50%;
  bottom: 96px;
  transform: translateX(-50%);
  z-index: 70;
  width: min(560px, calc(100vw - 28px));
  max-height: min(66vh, 560px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 14px;
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 20px 56px rgba(0, 0, 0, 0.32);
  overflow: hidden;
}
.bc-quickHead { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 8px 0 12px; }
.bc-quickTabs { display: flex; gap: 2px; }
.bc-quickTab {
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  padding: 5px 9px;
  border-radius: 7px;
  cursor: pointer;
}
.bc-quickTab:hover { background: var(--dsw-alias-bg-layer-2); }
.bc-quickTab.is-active { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); font-weight: 600; }
.bc-quickSearchWrap { display: flex; align-items: center; gap: 8px; padding: 8px 12px; color: var(--dsw-alias-label-secondary); border-bottom: 1px solid var(--dsw-alias-border-l1); }
.bc-quickSearch { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; }
.bc-quickSearch::placeholder { color: var(--dsw-alias-label-secondary); }
.bc-quickList { flex: 1; min-height: 60px; overflow: auto; padding: 6px; }
.bc-quickRow {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  box-sizing: border-box;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  padding: 7px 8px;
  cursor: pointer;
}
.bc-quickRow.is-active { background: var(--dsw-alias-bg-layer-2); }
.bc-quickKind { display: inline-flex; color: var(--dsw-alias-label-secondary); flex: none; }
.bc-quickThumbWrap {
  width: 44px;
  height: 32px;
  flex: none;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2);
}
.bc-quickThumb { width: 100%; height: 100%; object-fit: cover; display: block; }
.bc-quickBody { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.bc-quickTitle { font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bc-quickMeta { font-size: 10.5px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bc-quickAction { display: inline-flex; color: var(--dsw-alias-label-secondary); flex: none; }
.bc-quickEmpty { margin: 0; padding: 26px 12px; text-align: center; color: var(--dsw-alias-label-secondary); font-size: 12.5px; }
.bc-quickFoot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; border-top: 1px solid var(--dsw-alias-border-l1); }
.bc-quickHint { color: var(--dsw-alias-label-secondary); font-size: 10.5px; }
.bc-quickFlash {
  position: absolute;
  left: 50%;
  bottom: 52px;
  transform: translateX(-50%);
  padding: 5px 10px;
  border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-size: 11.5px;
  pointer-events: none;
}
@media (max-width: 720px) {
  .bc-page { padding: 18px 16px 48px; }
  .bc-head { flex-direction: column; }
  .bc-toolbarEnd { margin-left: 0; }
  .bc-item.is-row .bc-itemHead { width: 74px; }
}
`;

    /* ------------------------------------------------------------------ */
    /* Plugin                                                             */
    /* ------------------------------------------------------------------ */

    return {
      inject: ['slots', 'locale', 'layout'],
      apply(ctx) {
        hostContext = ctx;
        ctx.effect(() => ctx.locale.register(NS, { zh, en }));
        translate = ctx.locale.bind(NS);

        ctx.effect(() => {
          const style = document.createElement('style');
          style.setAttribute('data-athand', '');
          style.textContent = CSS;
          document.head.appendChild(style);
          return () => style.remove();
        });

        ctx.effect(() => {
          const flush = () => store.flush();
          window.addEventListener('pagehide', flush);
          return () => window.removeEventListener('pagehide', flush);
        });

        ctx.effect(() => {
          void hostBridge.start();
          return () => hostBridge.stop();
        });

        const t = translate;

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
        }, ClipboardPage));

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 30,
          locale: NS,
          label: () => t('panel'),
        }, PanelIcon));

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'athand-quick',
          order: 40,
          locale: NS,
          inject: () => ({
            onOpenPanel: () => {
              if (ctx.layout && typeof ctx.layout.selectPanel === 'function') ctx.layout.selectPanel(PANEL_ID);
            },
          }),
        }, QuickPanel));

        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'athand-composer',
          order: 30,
          locale: NS,
        }, ComposerButton));
      },
    };
  },
});
