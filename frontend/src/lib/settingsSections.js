export const SETTINGS_SECTIONS = [
  {
    key: "appearance",
    label: "Appearance",
    icon: "ph-paint-brush",
    hint: "How DevNote looks on this device.",
  },
  {
    key: "account",
    label: "Account",
    icon: "ph-user-circle",
    hint: "Your identity and credentials.",
  },
  {
    key: "defaults",
    label: "Defaults",
    icon: "ph-sliders-horizontal",
    hint: "What DevNote picks for you when you create something.",
  },
  {
    key: "danger",
    label: "Danger zone",
    icon: "ph-warning-octagon",
    hint: "Irreversible actions on your data.",
    isDanger: true,
  },
];

export const DEFAULT_SETTINGS_SECTION = SETTINGS_SECTIONS[0].key;

export const findSettingsSection = (key) =>
  SETTINGS_SECTIONS.find((section) => section.key === key) ??
  SETTINGS_SECTIONS[0];
