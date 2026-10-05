// База данных опасных грузов ДОПОГ с поддержкой тары/упаковок и ЦИСТЕРН
// Согласно подразделу 1.10.3.1.2 ДОПОГ (Перечень грузов повышенной опасности - ОГПО)

const DOPOG_DATABASE = [
  {
    un: "1202",
    name_ru: "ТОПЛИВО ДИЗЕЛЬНОЕ / ГАЗОЙЛЬ / ТОПЛИВО ПЕЧНОЕ ЛЕГКОЕ",
    class: "3",
    pg: "III",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "В упаковках (бочки, канистры, еврокубы) НЕ относится к грузам повышенной опасности (ОГПО). Спецразрешение НЕ требуется.",
    is_hcdg_tank: false,
    threshold_tank: null,
    reason_tank: "Дизельное топливо относится к группе упаковки III (ГУ III). В подразделе 1.10.3.1.2 ДОПОГ для класса 3 статус ОГПО в цистернах установлен только для групп упаковки I и II. Для ГУ III в цистернах спецразрешение НЕ требуется (подтверждено Решением ВС РФ № АКПИ13-847).",
    note: "Требуется стандартный допуск ДОПОГ на тягач/цистерну и свидетельство ДОПОГ водителя."
  },
  {
    un: "1203",
    name_ru: "БЕНЗИН МОТОРНЫЙ / ГАЗОХОЛ",
    class: "3",
    pg: "II",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "В упаковках, бочках и таре НЕ относится к ОГПО. Спецразрешение НЕ требуется.",
    is_hcdg_tank: true,
    threshold_tank: 3000,
    reason_tank: "Бензин относится к классу 3, группе упаковки II (ГУ II). Согласно ДОПОГ 1.10.3.1.2, при перевозке в цистернах вместимостью БОЛЕЕ 3 000 литров является грузом повышенной опасности (ОГПО). Требуется спецразрешение Ространснадзора!",
    note: "В цистернах объемом <= 3000 л спецразрешение не требуется; свыше 3000 л — обязательно получение СР."
  },
  {
    un: "1223",
    name_ru: "КЕРОСИН",
    class: "3",
    pg: "III",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "В упаковках и бочках спецразрешение НЕ требуется.",
    is_hcdg_tank: false,
    threshold_tank: null,
    reason_tank: "Керосин относится к ГУ III. В цистернах не относится к ОГПО (только ГУ I и II). Спецразрешение НЕ требуется.",
    note: "Обычный ДОПОГ."
  },
  {
    un: "1263",
    name_ru: "КРАСКА (включая краску, лак, эмаль, краситель, шеллак, олифу)",
    class: "3",
    pg: "II / III",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "В таре/бочках/банках спецразрешение НЕ требуется.",
    is_hcdg_tank: true,
    threshold_tank: 3000,
    reason_tank: "Для группы упаковки II в цистернах вместимостью более 3000 л требуется спецразрешение (ОГПО). Для ГУ III спецразрешение в цистернах не требуется.",
    note: "Уточните группу упаковки по паспорту безопасности (MSDS)."
  },
  {
    un: "1090",
    name_ru: "АЦЕТОН",
    class: "3",
    pg: "II",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "В упаковках и бочках спецразрешение НЕ требуется.",
    is_hcdg_tank: true,
    threshold_tank: 3000,
    reason_tank: "Класс 3 ГУ II в цистернах вместимостью более 3 000 л относится к ОГПО. Требуется спецразрешение Ространснадзора.",
    note: "ОГПО при объеме цистерны более 3000 л."
  },
  {
    un: "1170",
    name_ru: "СПИРТ ЭТИЛОВЫЙ (ЭТАНОЛ) или РАСТВОР ЭТАНОЛА",
    class: "3",
    pg: "II / III",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "В упаковках и бочках спецразрешение НЕ требуется.",
    is_hcdg_tank: true,
    threshold_tank: 3000,
    reason_tank: "Для ГУ II в цистернах более 3000 л требуется спецразрешение (ОГПО). Для ГУ III спецразрешение не требуется.",
    note: "Обычный ДОПОГ при перевозке в бочках/кубах."
  },
  {
    un: "1204",
    name_ru: "НИТРОГЛИЦЕРИНА СПИРТОВОЙ РАСТВОР (не более 1% нитроглицерина)",
    class: "3",
    pg: "II",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Десенсибилизированное взрывчатое вещество класса 3 (п. 1.10.3.1.2 ДОПОГ). Требуется спецразрешение при ЛЮБОМ количестве!",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "Десенсибилизированное взрывчатое вещество. Перевозка в цистернах требует спецразрешения при любом объеме.",
    note: "ОГПО! Обязательно специальное разрешение."
  },
  {
    un: "2059",
    name_ru: "НИТРОЦЕЛЛЮЛОЗЫ РАСТВОР ЛЕГКОВОСПЛАМЕНЯЮЩИЙСЯ",
    class: "3",
    pg: "I / II",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Десенсибилизированное взрывчатое вещество класса 3. Требуется спецразрешение при любом количестве.",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "Десенсибилизированное взрывчатое вещество. Требуется спецразрешение при любом объеме цистерны.",
    note: "ОГПО! Обязательно специальное разрешение."
  },
  {
    un: "1005",
    name_ru: "АММИАК БЕЗВОДНЫЙ",
    class: "2.3 (8)",
    pg: "-",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Токсичный газ (код 2TC). Согласно Таблице 1.10.3.1.2 ДОПОГ, токсичные газы в баллонах/сосудах требуют спецразрешения при ЛЮБОМ количестве (0 кг)!",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "Токсичный газ (код 2TC). В цистернах любой вместимости требует спецразрешения Ространснадзора (порог 0 л)!",
    note: "ОГПО повышенной опасности. Обязательно спецразрешение и согласование маршрута."
  },
  {
    un: "1017",
    name_ru: "ХЛОР",
    class: "2.3 (5.1, 8)",
    pg: "-",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Токсичный и окисляющий газ (код 2TOC). Требуется спецразрешение при ЛЮБОМ количестве баллонов (0 кг)!",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "Токсичный окисляющий газ. В цистернах любой вместимости требует спецразрешения Ространснадзора!",
    note: "ОГПО повышенной опасности."
  },
  {
    un: "1052",
    name_ru: "ВОДОРОД ФТОРИСТЫЙ БЕЗВОДНЫЙ",
    class: "8 (6.1)",
    pg: "I",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Токсичное и коррозионное вещество высокой степени опасности. Требуется спецразрешение при любом количестве.",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "В цистернах требует спецразрешения при любом объеме.",
    note: "ОГПО! Обязательно спецразрешение."
  },
  {
    un: "1053",
    name_ru: "СЕРОВОДОРОД",
    class: "2.3 (2.1)",
    pg: "-",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Токсичный воспламеняющийся газ (код 2TF). Требуется спецразрешение при любом количестве.",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "Токсичный воспламеняющийся газ. В цистернах требует спецразрешения при любом объеме.",
    note: "ОГПО! Обязательно спецразрешение."
  },
  {
    un: "1076",
    name_ru: "ФОСГЕН",
    class: "2.3 (8)",
    pg: "-",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Высокотоксичный газ (код 2TC). Требуется спецразрешение при любом количестве баллонов.",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "Высокотоксичный газ в цистернах требует спецразрешения при любом объеме (порог 0 л).",
    note: "ОГПО! Особый контроль и спецразрешение."
  },
  {
    un: "1978",
    name_ru: "ПРОПАН / ГАЗ СЖИЖЕННЫЙ (СУГ)",
    class: "2.1",
    pg: "-",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "Воспламеняющийся газ. В баллонах (упаковках) НЕ относится к ОГПО. Спецразрешение НЕ требуется.",
    is_hcdg_tank: true,
    threshold_tank: 3000,
    reason_tank: "Воспламеняющийся газ класса 2 (код с буквой F). Согласно ДОПОГ 1.10.3.1.2, в цистернах вместимостью БОЛЕЕ 3 000 литров является грузом повышенной опасности (ОГПО). Требуется спецразрешение Ространснадзора!",
    note: "В газовозах (цистернах) >3000 л требуется спецразрешение; в баллонах — не требуется."
  },
  {
    un: "1011",
    name_ru: "БУТАН",
    class: "2.1",
    pg: "-",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "Воспламеняющийся газ в баллонах. Спецразрешение НЕ требуется.",
    is_hcdg_tank: true,
    threshold_tank: 3000,
    reason_tank: "В цистернах вместимостью более 3000 л относится к ОГПО. Требуется спецразрешение Ространснадзора!",
    note: "Спецразрешение требуется только в цистернах свыше 3 куб.м."
  },
  {
    un: "1072",
    name_ru: "КИСЛОРОД СЖАТЫЙ",
    class: "2.2 (5.1)",
    pg: "-",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "Невоспламеняющийся нетоксичный газ (окисляющий). В баллонах спецразрешение НЕ требуется.",
    is_hcdg_tank: false,
    threshold_tank: null,
    reason_tank: "Газы подкласса 2.2 с кодами O или A в цистернах не входят в перечень ОГПО (табл. 1.10.3.1.2). Спецразрешение НЕ требуется.",
    note: "Обычный ДОПОГ."
  },
  {
    un: "1001",
    name_ru: "АЦЕТИЛЕН РАСТВОРЕННЫЙ",
    class: "2.1",
    pg: "-",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "В баллонах не относится к ОГПО. Спецразрешение НЕ требуется.",
    is_hcdg_tank: true,
    threshold_tank: 3000,
    reason_tank: "Воспламеняющийся газ класса 2.1 в цистернах свыше 3000 л требует спецразрешения.",
    note: "Обычный ДОПОГ в баллонах."
  },
  {
    un: "1046",
    name_ru: "ГЕЛИЙ СЖАТЫЙ",
    class: "2.2",
    pg: "-",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "Инертный газ. Спецразрешение НЕ требуется.",
    is_hcdg_tank: false,
    threshold_tank: null,
    reason_tank: "В цистернах не относится к ОГПО. Спецразрешение НЕ требуется.",
    note: "Обычный ДОПОГ."
  },
  {
    un: "1066",
    name_ru: "АЗОТ СЖАТЫЙ",
    class: "2.2",
    pg: "-",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "Инертный газ в баллонах. Спецразрешение НЕ требуется.",
    is_hcdg_tank: false,
    threshold_tank: null,
    reason_tank: "В цистернах не относится к ОГПО. Спецразрешение НЕ требуется.",
    note: "Обычный ДОПОГ."
  },
  {
    un: "1013",
    name_ru: "ДИОКСИД УГЛЕРОДА (УГЛЕКИСЛОТА)",
    class: "2.2",
    pg: "-",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "В баллонах спецразрешение НЕ требуется.",
    is_hcdg_tank: false,
    threshold_tank: null,
    reason_tank: "Углекислота в цистернах не относится к ОГПО. Спецразрешение НЕ требуется.",
    note: "Обычный ДОПОГ."
  },
  {
    un: "1942",
    name_ru: "АММОНИЯ НИТРАТ (СЕЛИТРА АММИАЧНАЯ)",
    class: "5.1",
    pg: "III",
    is_hcdg_package: true,
    threshold_package: 3000,
    reason_package: "Окисляющее вещество. В упаковках (биг-бэги, мешки) относится к ОГПО при массе БОЛЕЕ 3 000 кг!",
    is_hcdg_tank: true,
    threshold_tank: 3000,
    reason_tank: "В цистернах вместимостью более 3000 л относится к ОГПО. Требуется спецразрешение Ространснадзора.",
    note: "При количестве <= 3000 кг/л спецразрешение НЕ нужно; свыше 3000 — требуется СР."
  },
  {
    un: "2067",
    name_ru: "УДОБРЕНИЯ НА ОСНОВЕ НИТРАТА АММОНИЯ",
    class: "5.1",
    pg: "III",
    is_hcdg_package: true,
    threshold_package: 3000,
    reason_package: "В упаковках относится к ОГПО при количестве БОЛЕЕ 3 000 кг.",
    is_hcdg_tank: true,
    threshold_tank: 3000,
    reason_tank: "В цистернах относится к ОГПО при вместимости БОЛЕЕ 3 000 л.",
    note: "Спецразрешение требуется при превышении 3 тонн."
  },
  {
    un: "1565",
    name_ru: "БАРИЯ ЦИАНИД",
    class: "6.1",
    pg: "I",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Токсичное вещество группы упаковки I. Требует спецразрешения при ЛЮБОМ количестве (порог 0 кг)!",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "Вещество группы упаковки I в цистернах требует спецразрешения при любом объеме.",
    note: "ОГПО! Обязательно получение спецразрешения."
  },
  {
    un: "1689",
    name_ru: "НАТРИЯ ЦИАНИД ТВЕРДЫЙ",
    class: "6.1",
    pg: "I",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Токсичное вещество группы упаковки I (сильный яд). Требуется спецразрешение при ЛЮБОМ количестве!",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "В цистернах требует спецразрешения при любом объеме (порог 0 кг/л).",
    note: "ОГПО! Требуется спецразрешение Ространснадзора."
  },
  {
    un: "1680",
    name_ru: "КАЛИЯ ЦИАНИД ТВЕРДЫЙ",
    class: "6.1",
    pg: "I",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Токсичное вещество группы упаковки I. Требуется спецразрешение при ЛЮБОМ количестве!",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "В цистернах требует спецразрешения при любом количестве.",
    note: "ОГПО! Требуется спецразрешение."
  },
  {
    un: "2814",
    name_ru: "ИНФЕКЦИОННОЕ ВЕЩЕСТВО, ОПАСНОЕ ДЛЯ ЛЮДЕЙ (Категория А)",
    class: "6.2",
    pg: "-",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Инфекционные вещества категории А требуют спецразрешения при ЛЮБОМ количестве (порог 0 кг).",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "Требуется спецразрешение при любом количестве.",
    note: "ОГПО! Обязательно спецразрешение."
  },
  {
    un: "2900",
    name_ru: "ИНФЕКЦИОННОЕ ВЕЩЕСТВО, ОПАСНОЕ ТОЛЬКО ДЛЯ ЖИВОТНЫХ",
    class: "6.2",
    pg: "-",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Инфекционные вещества категории А. Требуется спецразрешение при любом количестве.",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "Требуется спецразрешение при любом количестве.",
    note: "ОГПО! Обязательно спецразрешение."
  },
  {
    un: "0081",
    name_ru: "ВЗРЫВЧАТОЕ ВЕЩЕСТВО ТИПА A",
    class: "1.1D",
    pg: "-",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Взрывчатые вещества подкласса 1.1 требуют спецразрешения при ЛЮБОМ количестве (0 кг)!",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "Взрывчатые вещества требуют спецразрешения при любом количестве.",
    note: "ОГПО повышенной опасности. Требуется спецразрешение и охрана/сопровождение."
  },
  {
    un: "0082",
    name_ru: "ВЗРЫВЧАТОЕ ВЕЩЕСТВО ТИПА B",
    class: "1.1D",
    pg: "-",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Взрывчатые вещества подкласса 1.1. Спецразрешение требуется при любом количестве.",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "Требуется спецразрешение при любом количестве.",
    note: "ОГПО! Требуется спецразрешение."
  },
  {
    un: "0029",
    name_ru: "ДЕТОНАТОРЫ НЕЭЛЕКТРИЧЕСКИЕ для взрывных работ",
    class: "1.1B",
    pg: "-",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Взрывчатые изделия подкласса 1.1. Требуется спецразрешение при любом количестве!",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "Требуется спецразрешение при любом количестве.",
    note: "ОГПО! Требуется спецразрешение."
  },
  {
    un: "1830",
    name_ru: "КИСЛОТА СЕРНАЯ с содержанием более 51% кислоты",
    class: "8",
    pg: "II",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "В упаковках/канистрах/бочках класс 8 НЕ относится к грузам повышенной опасности (ОГПО). Спецразрешение НЕ требуется.",
    is_hcdg_tank: false,
    threshold_tank: null,
    reason_tank: "Серная кислота относится к группе упаковки II (ГУ II). В подразделе 1.10.3.1.2 ДОПОГ класс 8 в цистернах относится к ОГПО ТОЛЬКО для группы упаковки I (ГУ I). Для ГУ II в цистернах спецразрешение НЕ требуется.",
    note: "Обычный ДОПОГ (при превышении правила 1000 баллов)."
  },
  {
    un: "1789",
    name_ru: "КИСЛОТА СОЛЯНАЯ",
    class: "8",
    pg: "II",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "В таре и бочках спецразрешение НЕ требуется.",
    is_hcdg_tank: false,
    threshold_tank: null,
    reason_tank: "ГУ II в цистернах не относится к ОГПО. Спецразрешение НЕ требуется.",
    note: "Обычный ДОПОГ."
  },
  {
    un: "1824",
    name_ru: "НАТРИЯ ГИДРОКСИДА РАСТВОР (ЕДКИЙ НАТР)",
    class: "8",
    pg: "II",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "В канистрах/бочках спецразрешение НЕ требуется.",
    is_hcdg_tank: false,
    threshold_tank: null,
    reason_tank: "ГУ II в цистернах не относится к ОГПО. Спецразрешение НЕ требуется.",
    note: "Обычный ДОПОГ."
  },
  {
    un: "1383",
    name_ru: "АЛЮМИНИЙ ПИРОФОРНЫЙ",
    class: "4.2",
    pg: "I",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Вещество, способное к самовозгоранию, группы упаковки I. Требуется спецразрешение при любом количестве!",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "В цистернах требует спецразрешения при любом объеме.",
    note: "ОГПО! Обязательно спецразрешение."
  },
  {
    un: "1402",
    name_ru: "КАЛЬЦИЯ КАРБИД",
    class: "4.3",
    pg: "I / II",
    is_hcdg_package: true,
    threshold_package: 0,
    reason_package: "Для группы упаковки I выделяет горючие газы при контакте с водой. Требуется спецразрешение при любом количестве.",
    is_hcdg_tank: true,
    threshold_tank: 0,
    reason_tank: "Для ГУ I требуется спецразрешение при любом объеме, для ГУ II в цистернах — свыше 3000 кг.",
    note: "Для ГУ I требуется СР, для ГУ II в упаковках не требуется."
  },
  {
    un: "3082",
    name_ru: "ВЕЩЕСТВО, ОПАСНОЕ ДЛЯ ОКРУЖАЮЩЕЙ СРЕДЫ, ЖИДКОЕ, Н.У.К.",
    class: "9",
    pg: "III",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "Класс 9 в упаковках не относится к ОГПО. Спецразрешение НЕ требуется.",
    is_hcdg_tank: false,
    threshold_tank: null,
    reason_tank: "Класс 9 в цистернах не входит в перечень ОГПО (за исключением диоксинов/ПХД). Спецразрешение НЕ требуется.",
    note: "Обычный ДОПОГ."
  },
  {
    un: "3480",
    name_ru: "БАТАРЕИ ИОННО-ЛИТИЕВЫЕ",
    class: "9",
    pg: "-",
    is_hcdg_package: false,
    threshold_package: null,
    reason_package: "Класс 9 в упаковках не относится к ОГПО. Спецразрешение НЕ требуется.",
    is_hcdg_tank: false,
    threshold_tank: null,
    reason_tank: "В цистернах не перевозится.",
    note: "Применяются правила ДОПОГ по упаковке и маркировке."
  }
];

// Поиск по базе
function searchDopogGoods(query) {
  if (!query) return DOPOG_DATABASE.slice(0, 15);
  const q = query.trim().toLowerCase();
  return DOPOG_DATABASE.filter(item => 
    item.un.includes(q) || 
    item.name_ru.toLowerCase().includes(q) ||
    item.class.toLowerCase().includes(q)
  );
}

// Главная функция оценки груза с поддержкой цистерн и упаковок
function evaluatePackageCargo(unCode, amount = null, packageType = 'drums', customClass = null, customPg = null) {
  const code = unCode.trim().padStart(4, '0');
  const found = DOPOG_DATABASE.find(item => item.un === code);
  const isTank = (packageType === 'tank');

  if (found) {
    const isHcdg = isTank ? found.is_hcdg_tank : found.is_hcdg_package;
    const threshold = isTank ? found.threshold_tank : found.threshold_package;
    const reason = isTank ? found.reason_tank : found.reason_package;
    const unit = isTank ? 'л' : 'кг';

    if (!isHcdg) {
      return {
        un: found.un,
        name: found.name_ru,
        class: found.class,
        pg: found.pg,
        requires_permit: false,
        badge_type: "success",
        status_text: isTank ? "В ЦИСТЕРНЕ СПЕЦРАЗРЕШЕНИЕ НЕ ТРЕБУЕТСЯ" : "В УПАКОВКАХ СПЕЦРАЗРЕШЕНИЕ НЕ ТРЕБУЕТСЯ",
        reason: reason,
        note: found.note
      };
    } else {
      if (threshold === 0) {
        return {
          un: found.un,
          name: found.name_ru,
          class: found.class,
          pg: found.pg,
          requires_permit: true,
          badge_type: "danger",
          status_text: isTank ? "В ЦИСТЕРНЕ ТРЕБУЕТСЯ СПЕЦИАЛЬНОЕ РАЗРЕШЕНИЕ (ОГПО)" : "В УПАКОВКАХ ТРЕБУЕТСЯ СПЕЦИАЛЬНОЕ РАЗРЕШЕНИЕ (ОГПО)",
          reason: reason,
          note: found.note
        };
      } else if (threshold > 0) {
        if (amount !== null && amount > threshold) {
          return {
            un: found.un,
            name: found.name_ru,
            class: found.class,
            pg: found.pg,
            requires_permit: true,
            badge_type: "danger",
            status_text: `ТРЕБУЕТСЯ СПЕЦРАЗРЕШЕНИЕ (${isTank ? 'Объем цистерны' : 'Количество'} ${amount} ${unit} превышает порог ${threshold} ${unit})`,
            reason: reason,
            note: found.note
          };
        } else if (amount !== null && amount <= threshold) {
          return {
            un: found.un,
            name: found.name_ru,
            class: found.class,
            pg: found.pg,
            requires_permit: false,
            badge_type: "success",
            status_text: `СПЕЦРАЗРЕШЕНИЕ НЕ ТРЕБУЕТСЯ (${isTank ? 'Объем' : 'Количество'} ${amount} ${unit} не превышает порог ОГПО ${threshold} ${unit})`,
            reason: reason,
            note: found.note
          };
        } else {
          return {
            un: found.un,
            name: found.name_ru,
            class: found.class,
            pg: found.pg,
            requires_permit: true,
            badge_type: "warning",
            status_text: `ТРЕБУЕТСЯ СР ПРИ ${isTank ? 'ВМЕСТИМОСТИ ЦИСТЕРНЫ' : 'МАССЕ'} БОЛЕЕ ${threshold} ${unit.toUpperCase()}`,
            reason: reason,
            note: `Укажите фактический ${isTank ? 'объем цистерны' : 'вес груза'} для точного вердикта.`
          };
        }
      }
    }
  }

  // Общие правила ДОПОГ 1.10.3.1.2 для неизвестных номеров ООН
  if (customClass) {
    const c = customClass.toUpperCase();
    const pg = customPg ? customPg.toUpperCase() : "";

    // Класс 1 (Взрывчатые)
    if (c.startsWith("1.1") || c.startsWith("1.2") || c.startsWith("1.5") || c.startsWith("1.6")) {
      return {
        un: code,
        name: "Взрывчатое вещество / изделие",
        class: customClass,
        pg: "-",
        requires_permit: true,
        badge_type: "danger",
        status_text: "ТРЕБУЕТСЯ СПЕЦИАЛЬНОЕ РАЗРЕШЕНИЕ (ОГПО Класс 1)",
        reason: "Согласно ДОПОГ 1.10.3.1.2 взрывчатые вещества подклассов 1.1, 1.2, 1.5, 1.6 в любых количествах и таре являются грузами повышенной опасности.",
        note: "Обязательно спецразрешение Ространснадзора."
      };
    }

    // Класс 2 (Токсичные газы)
    if (c.includes("2.3") || c.includes("T")) {
      return {
        un: code,
        name: "Токсичный газ",
        class: customClass,
        pg: "-",
        requires_permit: true,
        badge_type: "danger",
        status_text: "ТРЕБУЕТСЯ СПЕЦИАЛЬНОЕ РАЗРЕШЕНИЕ (ОГПО Класс 2.3)",
        reason: "Токсичные газы (коды с буквой T) в любых баллонах и цистернах требуют СР при любом количестве (порог 0).",
        note: "Обязательно спецразрешение Ространснадзора."
      };
    }

    // Класс 2.1 (Воспламеняющиеся газы в цистернах)
    if ((c.includes("2.1") || c.includes("F")) && isTank) {
      if (amount !== null && amount <= 3000) {
        return {
          un: code,
          name: "Воспламеняющийся газ",
          class: customClass,
          pg: "-",
          requires_permit: false,
          badge_type: "success",
          status_text: "СПЕЦРАЗРЕШЕНИЕ НЕ ТРЕБУЕТСЯ (Объем цистерны <= 3 000 л)",
          reason: "Воспламеняющиеся газы в цистернах относятся к ОГПО только при вместимости более 3 000 л.",
          note: "Обычный ДОПОГ."
        };
      }
      return {
        un: code,
        name: "Воспламеняющийся газ",
        class: customClass,
        pg: "-",
        requires_permit: true,
        badge_type: "danger",
        status_text: "ТРЕБУЕТСЯ СПЕЦИАЛЬНОЕ РАЗРЕШЕНИЕ (ОГПО Класс 2.1 в цистерне >3000 л)",
        reason: "Воспламеняющиеся газы в цистернах вместимостью более 3000 л относятся к ОГПО (ДОПОГ 1.10.3.1.2).",
        note: "Требуется специальное разрешение."
      };
    }

    // Класс 3 в цистернах
    if (c.startsWith("3") && isTank) {
      if (pg === "I" || pg === "II" || pg === "1" || pg === "2") {
        return {
          un: code,
          name: "Легковоспламеняющаяся жидкость ГУ I / II",
          class: customClass,
          pg: pg,
          requires_permit: true,
          badge_type: "danger",
          status_text: "ТРЕБУЕТСЯ СПЕЦРАЗРЕШЕНИЕ (ОГПО Класс 3 ГУ I/II в цистерне >3000 л)",
          reason: "Жидкости класса 3 групп упаковки I и II в цистернах более 3000 л относятся к ОГПО.",
          note: "Требуется спецразрешение при объеме свыше 3000 л."
        };
      } else {
        return {
          un: code,
          name: "Легковоспламеняющаяся жидкость ГУ III",
          class: customClass,
          pg: "III",
          requires_permit: false,
          badge_type: "success",
          status_text: "СПЕЦРАЗРЕШЕНИЕ НЕ ТРЕБУЕТСЯ (Класс 3 ГУ III)",
          reason: "Для класса 3 группы упаковки III статус ОГПО в ДОПОГ 1.10.3.1.2 не установлен даже для цистерн.",
          note: "Обычный ДОПОГ."
        };
      }
    }

    // Класс 6.1 ГУ I
    if (c.includes("6.1") && (pg === "I" || pg === "1")) {
      return {
        un: code,
        name: "Токсичное вещество группы упаковки I",
        class: customClass,
        pg: "I",
        requires_permit: true,
        badge_type: "danger",
        status_text: "ТРЕБУЕТСЯ СПЕЦИАЛЬНОЕ РАЗРЕШЕНИЕ (ОГПО Класс 6.1 ГУ I)",
        reason: "Токсичные вещества группы упаковки I в цистернах или упаковках требуют СР при любом количестве (порог 0).",
        note: "Обязательно спецразрешение Ространснадзора."
      };
    }

    // Класс 8 в цистернах
    if (c.startsWith("8") && isTank) {
      if (pg === "I" || pg === "1") {
        return {
          un: code,
          name: "Коррозионное вещество ГУ I",
          class: customClass,
          pg: "I",
          requires_permit: true,
          badge_type: "danger",
          status_text: "ТРЕБУЕТСЯ СПЕЦРАЗРЕШЕНИЕ (ОГПО Класс 8 ГУ I в цистерне >3000 л)",
          reason: "Коррозионные вещества группы упаковки I в цистернах вместимостью более 3000 л относятся к ОГПО.",
          note: "Требуется спецразрешение."
        };
      } else {
        return {
          un: code,
          name: "Коррозионное вещество ГУ II / III",
          class: customClass,
          pg: pg || "-",
          requires_permit: false,
          badge_type: "success",
          status_text: "СПЕЦРАЗРЕШЕНИЕ НЕ ТРЕБУЕТСЯ (Класс 8 ГУ II/III)",
          reason: "Вещества класса 8 групп упаковки II и III в цистернах не относятся к ОГПО.",
          note: "Обычный ДОПОГ."
        };
      }
    }

    return {
      un: code,
      name: "Опасный груз",
      class: customClass,
      pg: pg || "-",
      requires_permit: false,
      badge_type: "success",
      status_text: "СПЕЦРАЗРЕШЕНИЕ НЕ ТРЕБУЕТСЯ",
      reason: "Для данного класса и типа перевозки статус груза повышенной опасности (ОГПО) не установлен.",
      note: "Требуются стандартные допуски ТС и свидетельство ДОПОГ водителя."
    };
  }

  return {
    un: code,
    name: "Груз не найден в экспресс-базе",
    class: "Уточните",
    pg: "-",
    requires_permit: false,
    badge_type: "warning",
    status_text: "УТОЧНИТЕ КЛАСС И ГРУППУ УПАКОВКИ",
    reason: "Для редких веществ сверьте класс опасности и группу упаковки по паспорту безопасности (MSDS).",
    note: "По правилам ДОПОГ 1.10.3.1.2: в цистернах свыше 3000 л СР требуют газы 2.1, жидкости класса 3 ГУ I/II, класс 8 ГУ I. Токсичные газы (2.3) и яды ГУ I требуют СР всегда (0 л)."
  };
}