/**
 * Leaderboard-digest copy, in the nine locales the web app supports.
 *
 * Placeholders: {title} {n} {range} {name} {rank} {minutes} {baseline}
 *               {done} {total} {groupMinutes}
 */
export interface DigestCopy {
  subject: string;
  heading: string;
  intro: string;
  yourRank: string;
  yourRankNotEntered: string;
  board: string;
  group: string;
  cta: string;
  optOut: string;
  /** Short unit shown after each leaderboard number. */
  minUnit: string;
}

export const DIGEST_COPY: Record<string, DigestCopy> = {
  en: {
    subject: "{title} — Week {n} leaderboard",
    heading: "Week {n} · {range}",
    intro: "Here's how the group is doing, {name}.",
    yourRank: "You're #{rank} this week with {minutes} minutes.",
    yourRankNotEntered: "You haven't added your minutes for this week yet.",
    board: "This week's leaderboard",
    group: "{groupMinutes} minutes as a group · {done} of {total} at {baseline}+",
    cta: "Open the challenge",
    optOut:
      "You're getting this because you're in {title} on KickStake. To stop these, open the app and turn off Leaderboard emails in the menu.",
    minUnit: "min",
  },
  es: {
    subject: "{title}: clasificación de la semana {n}",
    heading: "Semana {n} · {range}",
    intro: "Así va el grupo, {name}.",
    yourRank: "Vas #{rank} esta semana con {minutes} minutos.",
    yourRankNotEntered: "Todavía no has anotado tus minutos de esta semana.",
    board: "Clasificación de esta semana",
    group: "{groupMinutes} minutos en grupo · {done} de {total} con {baseline}+",
    cta: "Abrir el reto",
    optOut:
      "Recibes esto porque participas en {title} en KickStake. Para dejar de recibirlos, abre la app y desactiva los correos de clasificación en el menú.",
    minUnit: "min",
  },
  fr: {
    subject: "{title} — classement de la semaine {n}",
    heading: "Semaine {n} · {range}",
    intro: "Voici où en est le groupe, {name}.",
    yourRank: "Vous êtes {rank}e cette semaine avec {minutes} minutes.",
    yourRankNotEntered: "Vous n'avez pas encore saisi vos minutes pour cette semaine.",
    board: "Classement de la semaine",
    group: "{groupMinutes} minutes pour le groupe · {done} sur {total} à {baseline}+",
    cta: "Ouvrir le défi",
    optOut:
      "Vous recevez cet e-mail car vous participez à {title} sur KickStake. Pour ne plus les recevoir, ouvrez l'app et désactivez les e-mails de classement dans le menu.",
    minUnit: "min",
  },
  pt: {
    subject: "{title} — classificação da semana {n}",
    heading: "Semana {n} · {range}",
    intro: "Veja como o grupo está indo, {name}.",
    yourRank: "Você está em #{rank} nesta semana com {minutes} minutos.",
    yourRankNotEntered: "Você ainda não registrou seus minutos desta semana.",
    board: "Classificação desta semana",
    group: "{groupMinutes} minutos no grupo · {done} de {total} com {baseline}+",
    cta: "Abrir o desafio",
    optOut:
      "Você recebeu isto porque participa de {title} no KickStake. Para parar, abra o app e desative os e-mails de classificação no menu.",
    minUnit: "min",
  },
  ru: {
    subject: "{title} — рейтинг за неделю {n}",
    heading: "Неделя {n} · {range}",
    intro: "Вот как идут дела у группы, {name}.",
    yourRank: "Вы на {rank}-м месте на этой неделе — {minutes} минут.",
    yourRankNotEntered: "Вы ещё не указали свои минуты за эту неделю.",
    board: "Рейтинг за эту неделю",
    group: "{groupMinutes} минут у группы · {done} из {total} набрали {baseline}+",
    cta: "Открыть челлендж",
    optOut:
      "Вы получили это письмо, потому что участвуете в «{title}» на KickStake. Чтобы больше их не получать, откройте приложение и отключите письма с рейтингом в меню.",
    minUnit: "мин",
  },
  sr: {
    subject: "{title} — rang-lista za nedelju {n}",
    heading: "Nedelja {n} · {range}",
    intro: "Evo kako grupi ide, {name}.",
    yourRank: "Vi ste #{rank} ove nedelje sa {minutes} minuta.",
    yourRankNotEntered: "Još niste uneli svoje minute za ovu nedelju.",
    board: "Rang-lista ove nedelje",
    group: "{groupMinutes} minuta za grupu · {done} od {total} sa {baseline}+",
    cta: "Otvori izazov",
    optOut:
      "Ovo ste dobili jer učestvujete u izazovu {title} na KickStake-u. Da prestanete, otvorite aplikaciju i isključite mejlove sa rang-listom u meniju.",
    minUnit: "min",
  },
  zh: {
    subject: "{title} — 第 {n} 周排行榜",
    heading: "第 {n} 周 · {range}",
    intro: "{name}，来看看大家的进展。",
    yourRank: "本周你排第 {rank} 名，共 {minutes} 分钟。",
    yourRankNotEntered: "你还没有填写本周的分钟数。",
    board: "本周排行榜",
    group: "小组共 {groupMinutes} 分钟 · {total} 人中 {done} 人达到 {baseline}+",
    cta: "打开挑战",
    optOut:
      "你收到这封邮件是因为你参加了 KickStake 上的「{title}」。如需停止接收，请打开应用并在菜单中关闭排行榜邮件。",
    minUnit: "分钟",
  },
  hi: {
    subject: "{title} — हफ़्ते {n} की लीडरबोर्ड",
    heading: "हफ़्ता {n} · {range}",
    intro: "{name}, ग्रुप का हाल यह है।",
    yourRank: "इस हफ़्ते आप #{rank} पर हैं, {minutes} मिनट के साथ।",
    yourRankNotEntered: "आपने इस हफ़्ते के अपने मिनट अभी दर्ज नहीं किए हैं।",
    board: "इस हफ़्ते की लीडरबोर्ड",
    group: "ग्रुप के {groupMinutes} मिनट · {total} में से {done} ने {baseline}+ किया",
    cta: "चैलेंज खोलें",
    optOut:
      "आपको यह इसलिए मिला क्योंकि आप KickStake पर {title} में हैं। इन्हें बंद करने के लिए ऐप खोलें और मेन्यू में लीडरबोर्ड ईमेल बंद कर दें।",
    minUnit: "मिनट",
  },
  ar: {
    subject: "{title} — لوحة صدارة الأسبوع {n}",
    heading: "الأسبوع {n} · {range}",
    intro: "إليك أحوال المجموعة يا {name}.",
    yourRank: "أنت في المركز {rank} هذا الأسبوع بـ{minutes} دقيقة.",
    yourRankNotEntered: "لم تسجّل دقائقك لهذا الأسبوع بعد.",
    board: "لوحة صدارة هذا الأسبوع",
    group: "{groupMinutes} دقيقة للمجموعة · {done} من {total} بلغوا {baseline}+",
    cta: "افتح التحدي",
    optOut:
      "وصلتك هذه الرسالة لأنك مشارك في {title} على KickStake. لإيقافها، افتح التطبيق وعطّل رسائل لوحة الصدارة من القائمة.",
    minUnit: "د",
  },
};

export const digestCopy = (locale: string): DigestCopy => DIGEST_COPY[locale] ?? DIGEST_COPY.en;
