export class HomeBaseUIController {
  constructor(options = {}) {
    this.onOpenStateChanged = typeof options.onOpenStateChanged === "function"
      ? options.onOpenStateChanged
      : null;
    this.currentPanelConfig = null;
    this._buildDom();
  }

  _buildDom() {
    this.root = document.createElement("div");
    this.root.id = "home-base-panel-overlay";
    this.root.className = "home-base-panel-overlay hidden";
    this.root.innerHTML = `
      <div class="home-base-panel">
        <header class="home-base-panel-header">
          <h2 id="home-base-panel-title" class="home-base-panel-title"></h2>
          <button id="home-base-panel-close" class="home-base-panel-close" type="button" aria-label="Close">Close</button>
        </header>
        <div id="home-base-panel-body" class="home-base-panel-body"></div>
        <div id="home-base-panel-actions" class="home-base-panel-actions"></div>
      </div>
    `;
    document.body.appendChild(this.root);

    this.titleEl = this.root.querySelector("#home-base-panel-title");
    this.bodyEl = this.root.querySelector("#home-base-panel-body");
    this.actionsEl = this.root.querySelector("#home-base-panel-actions");
    this.closeBtn = this.root.querySelector("#home-base-panel-close");

    this.closeBtn.addEventListener("click", () => this.close());
    this.root.addEventListener("click", (event) => {
      if (event.target === this.root) {
        this.close();
      }
    });
  }

  isOpen() {
    return !!this.root && !this.root.classList.contains("hidden");
  }

  openCustom(config) {
    if (!this.root || !this.titleEl || !this.bodyEl || !this.actionsEl) return;
    const title = String(config?.title || "Panel");
    const description = String(config?.description || "");
    const actions = Array.isArray(config?.actions) ? config.actions : [];
    const renderBody = typeof config?.renderBody === "function" ? config.renderBody : null;
    const bodyClassName = String(config?.bodyClassName || "");
    const onCloseRequest = typeof config?.onCloseRequest === "function" ? config.onCloseRequest : null;
    const closeLabel = String(config?.closeLabel || "Close");
    const hideCloseButton = config?.hideCloseButton === true;
    this.currentPanelConfig = { onCloseRequest };

    this.titleEl.textContent = title;
    this.bodyEl.className = `home-base-panel-body ${bodyClassName}`.trim();
    this.bodyEl.innerHTML = "";
    if (renderBody) {
      renderBody(this.bodyEl);
    } else {
      this.bodyEl.textContent = description;
    }
    this.actionsEl.innerHTML = "";
    if (this.closeBtn) {
      this.closeBtn.textContent = closeLabel;
      this.closeBtn.classList.toggle("hidden", hideCloseButton);
    }

    for (const action of actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `home-base-panel-button ${action?.className || ""}`.trim();
      btn.textContent = String(action?.label || "Action");
      btn.disabled = action?.disabled === true;
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        if (action?.closeOnClick !== false) {
          this.close();
        }
        if (typeof action?.onClick === "function") {
          action.onClick();
        }
      });
      this.actionsEl.appendChild(btn);
    }

    this.root.classList.remove("hidden");
    if (this.onOpenStateChanged) this.onOpenStateChanged(true);
  }

  openPlaceholder(title) {
    this.openCustom({
      title,
      description: `${title} is not connected yet. This is a placeholder panel.`,
      actions: [
        {
          label: "Close",
          className: "home-base-panel-button-secondary",
          onClick: () => {}
        }
      ]
    });
  }

  openPortalPanel(callbacks = {}) {
    this.openCustom({
      title: "Portal Gate",
      description: "Prepare your next expedition.",
      actions: [
        {
          label: "Start Expedition",
          className: "home-base-panel-button-primary",
          onClick: () => callbacks.onStartExpedition?.()
        },
        {
          label: "Choose Lures",
          className: "home-base-panel-button-secondary",
          onClick: () => callbacks.onChooseLures?.()
        },
        {
          label: "Close",
          className: "home-base-panel-button-secondary",
          onClick: () => {}
        }
      ]
    });
  }

  close() {
    if (!this.root || this.root.classList.contains("hidden")) return;
    const onCloseRequest = this.currentPanelConfig?.onCloseRequest;
    if (typeof onCloseRequest === "function") {
      const handled = onCloseRequest();
      if (handled) {
        return;
      }
    }
    this.root.classList.add("hidden");
    this.currentPanelConfig = null;
    if (this.onOpenStateChanged) this.onOpenStateChanged(false);
  }

  destroy() {
    if (!this.root) return;
    this.root.remove();
    this.root = null;
    this.titleEl = null;
    this.bodyEl = null;
    this.actionsEl = null;
    this.closeBtn = null;
    this.currentPanelConfig = null;
  }
}
