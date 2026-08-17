export const LOCALE_NAMESPACE = 'input-anywhere'

export const zh = {
  title: '输入框位置与外观',
  'group.general': '功能',
  enabled: '启用输入框移动与缩放',
  'group.surface': '输入框表面',
  surfaceMode: '透明度来源',
  surfaceTheme: '跟随主题',
  surfaceCustom: '自定义',
  surfaceOpaque: '不透明',
  surfaceOpacity: '自定义透明度',
  'group.controls': '输入框控件',
  controlsMode: '控件透明度',
  controlsSurface: '跟随输入框',
  controlsCustom: '自定义',
  controlsOpaque: '不透明',
  controlsOpacity: '自定义透明度',
  'group.overlap': '输出遮挡',
  overlapAware: '遮挡输出时自动调整',
  overlapIdleMode: '空闲时',
  overlapActiveMode: '输入时',
  adaptiveSurface: '跟随输入框',
  adaptiveCustom: '自定义',
  overlapIdleOpacity: '空闲时透明度',
  overlapActiveOpacity: '输入时透明度',
  resetSettings: '恢复默认设置',
  loading: '正在读取设置',
  memoryOnly: '设置仅在当前页面有效',
  saveError: '设置保存失败',
  moveInput: '移动输入框',
  resetPosition: '恢复输入框位置',
} as const

export const en: Record<keyof typeof zh, string> = {
  title: 'Input position and appearance',
  'group.general': 'Feature',
  enabled: 'Enable input movement and resizing',
  'group.surface': 'Input surface',
  surfaceMode: 'Transparency source',
  surfaceTheme: 'Follow theme',
  surfaceCustom: 'Custom',
  surfaceOpaque: 'Opaque',
  surfaceOpacity: 'Custom opacity',
  'group.controls': 'Input controls',
  controlsMode: 'Control opacity',
  controlsSurface: 'Follow input',
  controlsCustom: 'Custom',
  controlsOpaque: 'Opaque',
  controlsOpacity: 'Custom opacity',
  'group.overlap': 'Output overlap',
  overlapAware: 'Adjust while covering output',
  overlapIdleMode: 'While idle',
  overlapActiveMode: 'While entering text',
  adaptiveSurface: 'Follow input',
  adaptiveCustom: 'Custom',
  overlapIdleOpacity: 'Idle opacity',
  overlapActiveOpacity: 'Input-active opacity',
  resetSettings: 'Restore defaults',
  loading: 'Loading settings',
  memoryOnly: 'Settings apply to this page only',
  saveError: 'Could not save settings',
  moveInput: 'Move input',
  resetPosition: 'Reset input position',
}

export type InputAnywhereLocaleKey = keyof typeof zh
export type InputAnywhereTranslate = (key: InputAnywhereLocaleKey) => string

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'input-anywhere': InputAnywhereLocaleKey
  }
}
