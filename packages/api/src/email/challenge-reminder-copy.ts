/**
 * Reminder-email copy, in the nine locales the web app supports. The member's
 * locale is stored when they join (and kept in sync from the app), so the
 * email matches the language they use KickStake in.
 *
 * Placeholders: {title} {n} {range} {name} {baseline} {deadline}
 */
export interface ReminderCopy {
  subject: string;
  heading: string;
  lead: string;
  what: string;
  cta: string;
  deadline: string;
  optOut: string;
}

export const REMINDER_COPY: Record<string, ReminderCopy> = {
  en: {
    subject: "{title}: your Week {n} minutes",
    heading: "Week {n} · {range}",
    lead: "Hi {name}, you haven't added your minutes for Week {n} yet.",
    what: "Enter one number — your total active minutes for {range}. {baseline} minutes reaches the baseline.",
    cta: "Add my minutes",
    deadline: "You can still add or correct this until {deadline}.",
    optOut:
      "You're getting this because you're in {title} on KickStake. To stop these emails, open the app and turn off Email reminders in the menu.",
  },
  es: {
    subject: "{title}: tus minutos de la semana {n}",
    heading: "Semana {n} · {range}",
    lead: "Hola {name}: todavía no has anotado tus minutos de la semana {n}.",
    what: "Escribe un solo número: tus minutos activos totales del {range}. Con {baseline} minutos alcanzas la base.",
    cta: "Anotar mis minutos",
    deadline: "Puedes añadirlo o corregirlo hasta el {deadline}.",
    optOut:
      "Recibes esto porque participas en {title} en KickStake. Para dejar de recibirlos, abre la app y desactiva los recordatorios por correo en el menú.",
  },
  fr: {
    subject: "{title} : vos minutes de la semaine {n}",
    heading: "Semaine {n} · {range}",
    lead: "Bonjour {name}, vous n'avez pas encore saisi vos minutes de la semaine {n}.",
    what: "Un seul chiffre à saisir : votre total de minutes actives du {range}. {baseline} minutes suffisent pour atteindre la base.",
    cta: "Saisir mes minutes",
    deadline: "Vous pouvez encore l'ajouter ou le corriger jusqu'au {deadline}.",
    optOut:
      "Vous recevez cet e-mail car vous participez à {title} sur KickStake. Pour ne plus les recevoir, ouvrez l'app et désactivez les rappels par e-mail dans le menu.",
  },
  pt: {
    subject: "{title}: seus minutos da semana {n}",
    heading: "Semana {n} · {range}",
    lead: "Olá, {name}: você ainda não registrou seus minutos da semana {n}.",
    what: "Informe um número só — o total de minutos ativos de {range}. Com {baseline} minutos você alcança a base.",
    cta: "Registrar meus minutos",
    deadline: "Você ainda pode adicionar ou corrigir isso até {deadline}.",
    optOut:
      "Você recebeu este e-mail porque participa de {title} no KickStake. Para parar de recebê-los, abra o app e desative os lembretes por e-mail no menu.",
  },
  ru: {
    subject: "{title}: ваши минуты за неделю {n}",
    heading: "Неделя {n} · {range}",
    lead: "Здравствуйте, {name}! Вы ещё не указали свои минуты за неделю {n}.",
    what: "Нужно одно число — всего активных минут за {range}. {baseline} минут — это база.",
    cta: "Указать минуты",
    deadline: "Добавить или исправить можно до {deadline}.",
    optOut:
      "Вы получили это письмо, потому что участвуете в «{title}» на KickStake. Чтобы больше их не получать, откройте приложение и отключите напоминания по почте в меню.",
  },
  sr: {
    subject: "{title}: vaši minuti za nedelju {n}",
    heading: "Nedelja {n} · {range}",
    lead: "Zdravo {name}, još niste uneli svoje minute za nedelju {n}.",
    what: "Unesite samo jedan broj — ukupno aktivnih minuta za {range}. Sa {baseline} minuta dostižete osnovu.",
    cta: "Unesi moje minute",
    deadline: "Možete to dodati ili ispraviti do {deadline}.",
    optOut:
      "Ovo ste dobili jer učestvujete u izazovu {title} na KickStake-u. Da prestanete da ih primate, otvorite aplikaciju i isključite podsetnike mejlom u meniju.",
  },
  zh: {
    subject: "{title}：第 {n} 周的分钟数",
    heading: "第 {n} 周 · {range}",
    lead: "{name} 你好，你还没有填写第 {n} 周的分钟数。",
    what: "只需填一个数字：{range} 的运动总分钟数。达到 {baseline} 分钟即达到基准。",
    cta: "填写我的分钟数",
    deadline: "你可以在 {deadline} 之前填写或更正。",
    optOut:
      "你收到这封邮件是因为你参加了 KickStake 上的「{title}」。如需停止接收，请打开应用并在菜单中关闭邮件提醒。",
  },
  hi: {
    subject: "{title}: हफ़्ते {n} के आपके मिनट",
    heading: "हफ़्ता {n} · {range}",
    lead: "नमस्ते {name}, आपने हफ़्ते {n} के अपने मिनट अभी तक दर्ज नहीं किए हैं।",
    what: "बस एक नंबर दर्ज करें — {range} के आपके कुल एक्टिव मिनट। {baseline} मिनट पर बेसलाइन पूरा होता है।",
    cta: "मेरे मिनट दर्ज करें",
    deadline: "आप इसे {deadline} तक जोड़ या सुधार सकते हैं।",
    optOut:
      "आपको यह इसलिए मिला क्योंकि आप KickStake पर {title} में हैं। इन्हें बंद करने के लिए ऐप खोलें और मेन्यू में ईमेल रिमाइंडर बंद कर दें।",
  },
  ar: {
    subject: "{title}: دقائقك للأسبوع {n}",
    heading: "الأسبوع {n} · {range}",
    lead: "مرحبًا {name}، لم تسجّل دقائقك للأسبوع {n} بعد.",
    what: "أدخل رقمًا واحدًا فقط — إجمالي دقائق نشاطك في {range}. تبلغ الأساس عند {baseline} دقيقة.",
    cta: "تسجيل دقائقي",
    deadline: "يمكنك إضافتها أو تصحيحها حتى {deadline}.",
    optOut:
      "وصلتك هذه الرسالة لأنك مشارك في {title} على KickStake. لإيقافها، افتح التطبيق وعطّل تذكيرات البريد من القائمة.",
  },
};

export const reminderCopy = (locale: string): ReminderCopy =>
  REMINDER_COPY[locale] ?? REMINDER_COPY.en;

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in values ? String(values[key]) : `{${key}}`,
  );
}
