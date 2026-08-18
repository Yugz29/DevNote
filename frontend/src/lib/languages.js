export const DEVICONS = {
  javascript: "devicon-javascript-plain",
  python: "devicon-python-plain",
  java: "devicon-java-plain",
  csharp: "devicon-csharp-plain",
  php: "devicon-php-plain",
  ruby: "devicon-ruby-plain",
  go: "devicon-go-plain",
  rust: "devicon-rust-plain",
  html: "devicon-html5-plain",
  css: "devicon-css3-plain",
  bash: "devicon-bash-plain",
  sql: "devicon-azuresqldatabase-plain",
  typescript: "devicon-typescript-plain",
};

export const EXTENSIONS = {
  javascript: "js",
  python: "py",
  java: "java",
  csharp: "cs",
  php: "php",
  ruby: "rb",
  go: "go",
  rust: "rs",
  html: "html",
  css: "css",
  bash: "sh",
  sql: "sql",
  typescript: "ts",
};

export const DEFAULT_EXTENSION = "txt";

export function languageExtension(language) {
  return EXTENSIONS[language?.toLowerCase()] ?? DEFAULT_EXTENSION;
}

export const SNIPPET_LANGUAGES = ["text", ...Object.keys(DEVICONS)];

export const SNIPPET_LANGUAGE_OPTIONS = SNIPPET_LANGUAGES.map((language) => ({
  value: language,
  label: language,
}));
