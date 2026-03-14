export const getCareerCategoryClassName = (category: string): string => {
  const normalized = category.trim().toLowerCase();

  switch (normalized) {
    case "it":
      return "theme-it";
    case "ビジネス":
      return "theme-business";
    case "クリエイティブ":
      return "theme-creative";
    case "教育":
      return "theme-education";
    case "医療":
      return "theme-medical";
    case "サービス":
      return "theme-service";
    case "ものづくり":
      return "theme-manufacturing";
    case "公共":
      return "theme-public";
    case "メディア":
      return "theme-media";
    case "自由な働き方":
      return "theme-flex";
    default:
      return "theme-default";
  }
};

export const getCareerIllustration = (title: string, category: string): string => {
  const entries: Array<[string, string]> = [
    ["エンジニア", "💻"],
    ["プログラマー", "💻"],
    ["システム", "🖥️"],
    ["ネットワーク", "🌐"],
    ["ハッカー", "🛡️"],
    ["営業", "🤝"],
    ["経理", "📊"],
    ["法務", "⚖️"],
    ["デザイナー", "🎨"],
    ["サウンド", "🎧"],
    ["教授", "🎓"],
    ["教師", "📚"],
    ["インストラクター", "🧑‍🏫"],
    ["保育", "🧸"],
    ["薬剤師", "💊"],
    ["療法士", "🩺"],
    ["看護", "🩹"],
    ["歯科", "🦷"],
    ["ホテル", "🏨"],
    ["ツアー", "🧳"],
    ["美容", "✂️"],
    ["調理", "🍳"],
    ["農家", "🌾"],
    ["建築", "🏗️"],
    ["製造", "🏭"],
    ["公務員", "🏛️"],
    ["警察", "👮"],
    ["消防", "🚒"],
    ["記者", "📰"],
    ["編集", "📖"],
    ["ライター", "✍️"],
    ["ディレクター", "🧭"],
    ["起業", "🚀"],
    ["フリーランス", "🗂️"],
  ];

  const matched = entries.find(([keyword]) => title.includes(keyword));
  if (matched) {
    return matched[1];
  }

  switch (category) {
    case "IT":
      return "💻";
    case "ビジネス":
      return "📈";
    case "クリエイティブ":
      return "🎨";
    case "教育":
      return "📚";
    case "医療":
      return "🩺";
    case "サービス":
      return "🤲";
    case "ものづくり":
      return "🛠️";
    case "公共":
      return "🏛️";
    case "メディア":
      return "🎤";
    case "自由な働き方":
      return "✨";
    default:
      return "🧩";
  }
};

export const getStrengthCategoryClassName = (category: string): string => {
  switch (category) {
    case "対人":
      return "strength-theme-people";
    case "思考":
      return "strength-theme-thinking";
    case "行動":
      return "strength-theme-action";
    case "実務":
      return "strength-theme-practical";
    case "表現":
      return "strength-theme-expression";
    case "自己管理":
      return "strength-theme-self";
    default:
      return "strength-theme-default";
  }
};
