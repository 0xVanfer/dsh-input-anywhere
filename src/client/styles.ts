export const pluginStyles = String.raw`
.dsh-input-anywhere-controls {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
}

.dsh-input-anywhere-button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: grab;
  touch-action: none;
}

.dsh-input-anywhere-button:hover,
.dsh-input-anywhere-button:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.dsh-input-anywhere-button:focus-visible,
.dsh-input-anywhere-resize:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 1px;
}

.dsh-input-anywhere-button[data-action='reset'] {
  cursor: pointer;
}

.dsh-input-anywhere-grip {
  display: grid;
  grid-template-columns: repeat(2, 3px);
  gap: 3px;
}

.dsh-input-anywhere-grip > span {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
}

.dsh-input-anywhere-seat[data-input-anywhere-floating] {
  position: fixed !important;
  right: auto !important;
  bottom: auto !important;
  left: var(--dsh-input-anywhere-x) !important;
  top: var(--dsh-input-anywhere-y) !important;
  /* Local floating layer; shell and modal stacking remain owned by DSH. */
  z-index: 50 !important;
  box-sizing: border-box;
  width: var(--dsh-input-anywhere-width) !important;
  max-width: none !important;
  margin: 0 !important;
  transform: none !important;
  --dsh-composer-card-max-width: calc(var(--dsh-input-anywhere-width) - 32px);
  --dsh-chat-content-width: calc(var(--dsh-input-anywhere-width) - 64px);
}

.dsh-input-anywhere-seat[data-input-anywhere-floating][data-input-anywhere-themed] {
  /* Scope companion panels and in-seat menus to the same translucent hierarchy. */
  --dsw-specific-tip: var(--dsh-input-anywhere-surface);
  --dsw-specific-menu: var(--dsh-input-anywhere-menu-surface);
}

.dsh-input-anywhere-card {
  container-type: inline-size;
  --dsh-input-anywhere-compact-control: 28px;
}

.dsh-input-anywhere-card[data-input-anywhere-floating-card] {
  position: relative;
  background-color: var(--dsh-input-anywhere-surface, var(--dsw-specific-input-major));
  height: var(--dsh-input-anywhere-card-height);
  min-height: 116px;
  max-height: none;
}

.dsh-input-anywhere-card[data-input-anywhere-floating-card] [data-input-scroll] {
  flex: 1 1 auto;
  min-height: 48px;
  max-height: none;
}

.dsh-input-anywhere-card[data-input-anywhere-floating-card] [data-input-scroll] > :first-child {
  min-height: 100%;
}

.dsh-input-anywhere-scroll[data-input-anywhere-floating-host] {
  --dsh-composer-height: 0px !important;
}

.dsh-input-anywhere-resize-layer {
  position: absolute;
  /* Keep the hit targets mostly outside the card so they do not cover Send. */
  inset: -20px;
  z-index: 30;
  pointer-events: none;
}

.dsh-input-anywhere-resize {
  position: absolute;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  opacity: 0;
  pointer-events: auto;
  touch-action: none;
  transition: opacity 120ms ease;
}

.dsh-input-anywhere-resize:hover,
.dsh-input-anywhere-resize:active,
.dsh-input-anywhere-resize:focus,
html.dsh-input-anywhere-resizing .dsh-input-anywhere-resize {
  opacity: 1;
}

.dsh-input-anywhere-resize::before,
.dsh-input-anywhere-resize::after {
  content: '';
  position: absolute;
  width: 9px;
  height: 9px;
  border-color: currentColor;
  border-style: solid;
}

.dsh-input-anywhere-resize[data-direction='nw'] { top: 0; left: 0; cursor: nwse-resize; }
.dsh-input-anywhere-resize[data-direction='ne'] { top: 0; right: 0; cursor: nesw-resize; }
.dsh-input-anywhere-resize[data-direction='sw'] { bottom: 0; left: 0; cursor: nesw-resize; }
.dsh-input-anywhere-resize[data-direction='se'] { right: 0; bottom: 0; cursor: nwse-resize; }

.dsh-input-anywhere-resize[data-direction='nw']::before {
  top: 8px;
  left: 8px;
  border-width: 1px 0 0 1px;
}
.dsh-input-anywhere-resize[data-direction='ne']::before {
  top: 8px;
  right: 8px;
  border-width: 1px 1px 0 0;
}
.dsh-input-anywhere-resize[data-direction='sw']::before {
  bottom: 8px;
  left: 8px;
  border-width: 0 0 1px 1px;
}
.dsh-input-anywhere-resize[data-direction='se']::before {
  right: 8px;
  bottom: 8px;
  border-width: 0 1px 1px 0;
}

html.dsh-input-anywhere-interacting,
html.dsh-input-anywhere-interacting * {
  user-select: none !important;
}

@container (max-width: 680px) {
  .dsh-input-anywhere-controls {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10;
  }

  .dsh-input-anywhere-card [data-input-scroll] {
    margin-right: 104px;
  }
}

@container (max-width: 500px) {
  [data-input-anywhere-trailing] button[aria-haspopup='menu'] {
    justify-content: center;
    width: var(--dsh-input-anywhere-compact-control);
    max-width: var(--dsh-input-anywhere-compact-control);
    padding-inline: 0;
    overflow: hidden;
  }

  [data-input-anywhere-trailing] button[aria-haspopup='menu'] > span {
    display: none;
  }
}

@media (pointer: coarse) {
  .dsh-input-anywhere-card {
    --dsh-input-anywhere-compact-control: 44px;
  }

  .dsh-input-anywhere-button,
  .dsh-input-anywhere-resize {
    width: 44px;
    height: 44px;
  }

  .dsh-input-anywhere-resize-layer {
    inset: -36px;
  }

}

@media (prefers-reduced-motion: reduce) {
  .dsh-input-anywhere-resize {
    transition: none;
  }
}
`
