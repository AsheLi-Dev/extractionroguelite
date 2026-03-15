import {
  getAvailableLures,
  getMaxSelectedLures,
  getSelectedLureIds,
  getSelectedLures,
  getSelectedLureSummaryText,
  toggleLureSelection
} from "./lure-state.js";

function createSection(titleText) {
  const section = document.createElement("section");
  section.className = "home-base-panel-section";
  const title = document.createElement("h3");
  title.className = "home-base-panel-section-title";
  title.textContent = titleText;
  section.appendChild(title);
  return section;
}

function createLureBadge(label, active = false) {
  const badge = document.createElement("span");
  badge.className = `home-base-lure-badge${active ? " active" : ""}`;
  badge.textContent = label;
  return badge;
}

export class PortalPrepFlowController {
  constructor(options = {}) {
    this.ui = options.ui;
    this.onStartExpedition = typeof options.onStartExpedition === "function"
      ? options.onStartExpedition
      : null;

    this._starting = false;
    this._armedConfirmStart = false;
    this._statusMessage = "";
  }

  getSelectedLureIds() {
    return getSelectedLureIds();
  }

  openPortalPreparation() {
    this._armedConfirmStart = false;
    this._statusMessage = "";
    this._renderPortalPreparationPanel();
  }

  openLureSelection(options = {}) {
    const returnToPortal = options.returnToPortal === true;
    this._renderLureSelectionPanel(returnToPortal);
  }

  _renderPortalPreparationPanel() {
    if (!this.ui) return;
    const selectedLures = getSelectedLures();
    const selectedSummary = getSelectedLureSummaryText();
    const maxSelected = getMaxSelectedLures();
    const startDisabled = this._starting;
    const startLabel = this._starting
      ? "Starting..."
      : (this._armedConfirmStart ? "Confirm Start Expedition" : "Start Expedition");

    this.ui.openCustom({
      title: "Portal Gate Preparation",
      actions: [
        {
          label: "Edit Lures",
          className: "home-base-panel-button-secondary",
          closeOnClick: false,
          onClick: () => {
            this._armedConfirmStart = false;
            this.openLureSelection({ returnToPortal: true });
          }
        },
        {
          label: startLabel,
          className: "home-base-panel-button-primary",
          disabled: startDisabled,
          closeOnClick: false,
          onClick: () => this._handleStartClicked()
        },
        {
          label: "Close",
          className: "home-base-panel-button-secondary",
          onClick: () => {}
        }
      ],
      renderBody: (body) => {
        const summarySection = createSection("Active Lures");
        const summary = document.createElement("p");
        summary.className = "home-base-panel-inline-text";
        summary.textContent = `${selectedLures.length}/${maxSelected} equipped - ${selectedSummary}`;
        summarySection.appendChild(summary);

        const badges = document.createElement("div");
        badges.className = "home-base-lure-badge-row";
        if (selectedLures.length > 0) {
          for (const lure of selectedLures) {
            badges.appendChild(createLureBadge(lure.shortLabel || lure.name, true));
          }
        } else {
          badges.appendChild(createLureBadge("None"));
        }
        summarySection.appendChild(badges);

        const upcomingSection = createSection("Expedition Modifiers");
        const upcoming = document.createElement("p");
        upcoming.className = "home-base-panel-inline-text";
        upcoming.textContent = "Rites, proofs, and expedition routes will appear here in later phases.";
        upcomingSection.appendChild(upcoming);

        if (this._statusMessage) {
          const status = document.createElement("p");
          status.className = "home-base-panel-status";
          status.textContent = this._statusMessage;
          body.appendChild(status);
        }

        body.appendChild(summarySection);
        body.appendChild(upcomingSection);
      }
    });
  }

  _renderLureSelectionPanel(returnToPortal) {
    if (!this.ui) return;
    const allLures = getAvailableLures();
    const selectedIds = getSelectedLureIds();
    const selectedSet = new Set(selectedIds);
    const maxSelected = getMaxSelectedLures();
    const selectedLabel = `${selectedIds.length}/${maxSelected} selected`;

    this.ui.openCustom({
      title: "Lure Selection",
      actions: [
        {
          label: returnToPortal ? "Back to Portal" : "Done",
          className: "home-base-panel-button-primary",
          closeOnClick: !returnToPortal,
          onClick: () => {
            if (returnToPortal) {
              this._statusMessage = "";
              this._renderPortalPreparationPanel();
            }
          }
        },
        {
          label: "Close",
          className: "home-base-panel-button-secondary",
          onClick: () => {}
        }
      ],
      onCloseRequest: () => {
        if (returnToPortal) {
          this._statusMessage = "";
          this._renderPortalPreparationPanel();
          return true;
        }
        return false;
      },
      renderBody: (body) => {
        const summarySection = createSection("Selected Lures");
        const summaryText = document.createElement("p");
        summaryText.className = "home-base-panel-inline-text";
        summaryText.textContent = `${selectedLabel} - Equip up to ${maxSelected}`;
        summarySection.appendChild(summaryText);

        const selectedBadges = document.createElement("div");
        selectedBadges.className = "home-base-lure-badge-row";
        if (selectedIds.length > 0) {
          for (const lureId of selectedIds) {
            const lure = allLures.find((entry) => entry.id === lureId);
            if (!lure) continue;
            selectedBadges.appendChild(createLureBadge(lure.shortLabel || lure.name, true));
          }
        } else {
          selectedBadges.appendChild(createLureBadge("None"));
        }
        summarySection.appendChild(selectedBadges);
        body.appendChild(summarySection);

        const listSection = createSection("Available Lures");
        const list = document.createElement("div");
        list.className = "home-base-lure-list";
        for (const lure of allLures) {
          const isSelected = selectedSet.has(lure.id);
          const card = document.createElement("button");
          card.type = "button";
          card.className = `home-base-lure-card${isSelected ? " selected" : ""}`;
          card.innerHTML = `
            <div class="home-base-lure-card-top">
              <strong>${lure.name}</strong>
              <span>${isSelected ? "Equipped" : "Available"}</span>
            </div>
            <p>${lure.description}</p>
          `;
          card.addEventListener("click", () => {
            const result = toggleLureSelection(lure.id);
            if (!result.changed && result.reason === "max_selected") {
              this._statusMessage = `You can equip up to ${maxSelected} lures.`;
            } else {
              this._statusMessage = "";
            }
            this._renderLureSelectionPanel(returnToPortal);
          });
          list.appendChild(card);
        }
        listSection.appendChild(list);
        body.appendChild(listSection);

        if (this._statusMessage) {
          const status = document.createElement("p");
          status.className = "home-base-panel-status";
          status.textContent = this._statusMessage;
          body.appendChild(status);
        }
      }
    });
  }

  _handleStartClicked() {
    if (this._starting) return;
    if (!this._armedConfirmStart) {
      this._armedConfirmStart = true;
      this._statusMessage = "Press Start again to confirm expedition launch.";
      this._renderPortalPreparationPanel();
      return;
    }
    this._starting = true;
    this._statusMessage = "";
    this._renderPortalPreparationPanel();
    const selectedLureIds = getSelectedLureIds();
    Promise.resolve(this.onStartExpedition?.(selectedLureIds))
      .catch((error) => {
        console.error("Failed to start expedition", error);
      })
      .finally(() => {
        this._starting = false;
        this._armedConfirmStart = false;
        this._statusMessage = "";
        this.ui?.close();
      });
  }
}
