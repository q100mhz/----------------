// Расширенный справочник ДОПОГ с поддержкой Класса 1 (Взрывчатые вещества) и цистерн
const DOPOG_DATABASE = [
  // Образцы взрывчатых веществ Класса 1 из шаблона заявления УГАДН
  { un: "0005", name_ru: "ПАТРОНЫ ДЛЯ ОРУЖИЯ с разрывным зарядом", class: "1 (1.1F)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется специальное разрешение при любом количестве (порог 0 кг).", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение при любом количестве.", note: "ОГПО Класс 1." },
  { un: "0007", name_ru: "ПАТРОНЫ ДЛЯ ОРУЖИЯ с разрывным зарядом", class: "1 (1.2F)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение при любом количестве.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0029", name_ru: "ДЕТОНАТОРЫ НЕЭЛЕКТРИЧЕСКИЕ для взрывных работ", class: "1 (1.1B)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется специальное разрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0030", name_ru: "ДЕТОНАТОРЫ ЭЛЕКТРИЧЕСКИЕ для взрывных работ", class: "1 (1.1B)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0065", name_ru: "ШНУР ДЕТОНИРУЮЩИЙ гибкий", class: "1 (1.1D)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0106", name_ru: "Трубки детонационные", class: "1 (1.1B)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0161", name_ru: "ПОРОХ БЕЗДЫМНЫЙ", class: "1 (1.3C)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0167", name_ru: "СНАРЯДЫ с разрывным зарядом", class: "1 (1.1F)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0168", name_ru: "Снаряды с разрывным зарядом", class: "1 (1.1D)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0180", name_ru: "Ракеты с разрывным зарядом", class: "1 (1.1F)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0186", name_ru: "Двигатели ракетные", class: "1 (1.3C)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0242", name_ru: "Заряды метательные для орудий", class: "1 (1.3C)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0275", name_ru: "ПАТРОНЫ ДЛЯ ЗАПУСКА МЕХАНИЗМОВ", class: "1 (1.3C)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0293", name_ru: "ГРАНАТЫ ручные или ружейные с разрывным зарядом", class: "1 (1.2F)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0295", name_ru: "РАКЕТЫ с разрывным зарядом", class: "1 (1.2F)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0322", name_ru: "двигатели ракетные с гиперголической жидкостью", class: "1 (1.2L)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0332", name_ru: "взрывчатое вещество бризантное", class: "1 (1.5D)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0360", name_ru: "ДЕТОНАТОРОВ СБОРКИ НЕЭЛЕКТРИЧЕСКИЕ для взрывных работ", class: "1 (1.1B)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0366", name_ru: "ДЕТОНАТОРЫ ДЛЯ БОЕПРИПАСОВ", class: "1 (1.4S)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0377", name_ru: "КАПСЮЛИ-ВОСПЛАМЕНИТЕЛИ", class: "1 (1.1B)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },
  { un: "0469", name_ru: "ВЗРЫВЧАТЫЕ ИЗДЕЛИЯ, Н.У.К.", class: "1 (1.2F)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "ОГПО Класс 1. Требуется спецразрешение.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "Требуется спецразрешение.", note: "ОГПО Класс 1." },

  // Жидкие и газовые грузы
  { un: "1202", name_ru: "ТОПЛИВО ДИЗЕЛЬНОЕ / ГАЗОЙЛЬ / ТОПЛИВО ПЕЧНОЕ", class: "3", pg: "III", is_hcdg_package: false, threshold_package: null, reason_package: "В таре/бочках спецразрешение НЕ требуется.", is_hcdg_tank: false, threshold_tank: null, reason_tank: "Дизельное топливо (ГУ III) в цистернах не относится к ОГПО (Решение ВС РФ № АКПИ13-847). СР не требуется.", note: "Обычный ДОПОГ." },
  { un: "1203", name_ru: "БЕНЗИН МОТОРНЫЙ / ГАЗОХОЛ", class: "3", pg: "II", is_hcdg_package: false, threshold_package: null, reason_package: "В упаковках и бочках спецразрешение НЕ требуется.", is_hcdg_tank: true, threshold_tank: 3000, reason_tank: "В цистернах вместимостью более 3 000 л является ОГПО (ДОПОГ 1.10.3.1.2). Требуется спецразрешение!", note: "В цистернах >3000 л требуется СР." },
  { un: "1223", name_ru: "КЕРОСИН", class: "3", pg: "III", is_hcdg_package: false, threshold_package: null, reason_package: "Спецразрешение не требуется.", is_hcdg_tank: false, threshold_tank: null, reason_tank: "ГУ III в цистернах СР не требует.", note: "Обычный ДОПОГ." },
  { un: "1978", name_ru: "ПРОПАН / ГАЗ СЖИЖЕННЫЙ (СУГ)", class: "2.1", pg: "-", is_hcdg_package: false, threshold_package: null, reason_package: "В баллонах СР не требуется.", is_hcdg_tank: true, threshold_tank: 3000, reason_tank: "В цистернах более 3 000 л требуется спецразрешение Ространснадзора (ОГПО)!", note: "Газовозы >3000 л требуют СР." },
  { un: "1005", name_ru: "АММИАК БЕЗВОДНЫЙ", class: "2.3 (8)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "Токсичный газ. Требуется СР при любом количестве (порог 0 кг).", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "В цистернах требует СР при любом объеме.", note: "ОГПО повышенной опасности." },
  { un: "1017", name_ru: "ХЛОР", class: "2.3 (5.1, 8)", pg: "-", is_hcdg_package: true, threshold_package: 0, reason_package: "Токсичный газ. Требуется СР при любом количестве.", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "В цистернах требует СР при любом объеме.", note: "ОГПО." },
  { un: "1942", name_ru: "АММОНИЯ НИТРАТ (СЕЛИТРА АММИАЧНАЯ)", class: "5.1", pg: "III", is_hcdg_package: true, threshold_package: 3000, reason_package: "В упаковках относится к ОГПО при массе более 3 000 кг.", is_hcdg_tank: true, threshold_tank: 3000, reason_tank: "В цистернах >3000 л относится к ОГПО.", note: "Порог 3 000 кг." },
  { un: "1689", name_ru: "НАТРИЯ ЦИАНИД ТВЕРДЫЙ", class: "6.1", pg: "I", is_hcdg_package: true, threshold_package: 0, reason_package: "Токсичное вещество ГУ I. Требуется СР при любом количестве (порог 0).", is_hcdg_tank: true, threshold_tank: 0, reason_tank: "В цистернах требует СР при любом объеме.", note: "ОГПО." }
];

function searchDopogGoods(query) {
  if (!query) return DOPOG_DATABASE.slice(0, 15);
  const q = query.trim().toLowerCase();
  return DOPOG_DATABASE.filter(item => 
    item.un.includes(q) || item.name_ru.toLowerCase().includes(q)
  );
}

function getDopogGoodByUn(unCode) {
  const code = String(unCode).trim().padStart(4, '0');
  return DOPOG_DATABASE.find(item => item.un === code) || null;
}

function evaluatePackageCargo(unCode, amount = null, packageType = 'drums') {
  const code = String(unCode).trim().padStart(4, '0');
  const found = DOPOG_DATABASE.find(item => item.un === code);
  const isTank = (packageType === 'tank');

  if (found) {
    const isHcdg = isTank ? found.is_hcdg_tank : found.is_hcdg_package;
    const threshold = isTank ? found.threshold_tank : found.threshold_package;
    const reason = isTank ? found.reason_tank : found.reason_package;
    const unit = isTank ? 'л' : 'кг';

    if (!isHcdg) {
      return {
        un: found.un, name: found.name_ru, class: found.class, pg: found.pg,
        requires_permit: false, badge_type: "success",
        status_text: isTank ? "В ЦИСТЕРНЕ СПЕЦРАЗРЕШЕНИЕ НЕ ТРЕБУЕТСЯ" : "В УПАКОВКАХ СПЕЦРАЗРЕШЕНИЕ НЕ ТРЕБУЕТСЯ",
        reason: reason, note: found.note
      };
    } else {
      if (threshold === 0) {
        return {
          un: found.un, name: found.name_ru, class: found.class, pg: found.pg,
          requires_permit: true, badge_type: "danger",
          status_text: "ТРЕБУЕТСЯ СПЕЦИАЛЬНОЕ РАЗРЕШЕНИЕ (ОГПО)",
          reason: reason, note: found.note
        };
      } else if (threshold > 0) {
        if (amount !== null && amount > threshold) {
          return {
            un: found.un, name: found.name_ru, class: found.class, pg: found.pg,
            requires_permit: true, badge_type: "danger",
            status_text: `ТРЕБУЕТСЯ СПЕЦРАЗРЕШЕНИЕ (${amount} ${unit} > ${threshold} ${unit})`,
            reason: reason, note: found.note
          };
        } else if (amount !== null && amount <= threshold) {
          return {
            un: found.un, name: found.name_ru, class: found.class, pg: found.pg,
            requires_permit: false, badge_type: "success",
            status_text: `СПЕЦРАЗРЕШЕНИЕ НЕ ТРЕБУЕТСЯ (${amount} ${unit} <= ${threshold} ${unit})`,
            reason: reason, note: found.note
          };
        } else {
          return {
            un: found.un, name: found.name_ru, class: found.class, pg: found.pg,
            requires_permit: true, badge_type: "warning",
            status_text: `ТРЕБУЕТСЯ СР ПРИ КОЛИЧЕСТВЕ БОЛЕЕ ${threshold} ${unit.toUpperCase()}`,
            reason: reason, note: "Укажите фактическую массу/объем для точного расчета."
          };
        }
      }
    }
  }

  // Общее правило ДОПОГ для неизвестных номеров ООН
  const num = parseInt(code, 10);
  if (num >= 1 && num <= 3550) {
    return {
      un: code, name: "Опасный груз по ДОПОГ", class: "Уточните", pg: "-",
      requires_permit: false, badge_type: "success",
      status_text: "ОБЫЧНЫЙ ОПАСНЫЙ ГРУЗ (ДОПОГ)",
      reason: "Для большинства неособо опасных грузов статус ОГПО не установлен. Спецразрешение Ространснадзора не требуется.",
      note: "Требуется стандартное свидетельство ДОПОГ на ТС и водителя."
    };
  }

  return {
    un: code, name: "Номер ООН не найден", class: "-", pg: "-",
    requires_permit: false, badge_type: "danger",
    status_text: "НОМЕР ООН НЕ СУЩЕСТВУЕТ В ДОПОГ",
    reason: "Номера ООН состоят строго из 4 цифр в диапазоне от 0004 до 3550.",
    note: "Проверьте правильность ввода по паспорту безопасности (MSDS)."
  };
}