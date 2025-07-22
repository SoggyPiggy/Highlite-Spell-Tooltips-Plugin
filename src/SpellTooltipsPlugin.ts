import { Plugin, SettingsTypes } from "@highlite/plugin-api";
import styleCss from "./styles.css";

const hsRootContainerId = 'hs-screen-mask';
const tooltipId = 'hl-spell-tooltip';
const containerId = 'hl-spell-tooltip-container';
const styleId = 'hl-spell-tooltip-style';
const tooltipPixelWidth = 220;

export class SpellTooltipsPlugin extends Plugin {
    pluginName = 'Spell Tooltips';
    author = 'SoggyPiggy';
    containerDiv: HTMLDivElement | null = null;
    tooltipDiv: HTMLDivElement | null = null;
    spellDef: any = null;
    ingredientBackgroundPositions: string[] = [];
    keyDownCallback: ((event: KeyboardEvent) => void) | null = null;
    keyUpCallback: ((event: KeyboardEvent) => void) | null = null;
    isDevMode = false;
    isExpanded = this.isDevMode;

    constructor() {
        super();

        this.settings.enable = {
            text: 'Enable Spell Tooltips',
            type: SettingsTypes.checkbox,
            value: false,
            callback: () =>
                this.settings.enable.value ? this.start() : this.stop(),
        };

        this.settings.disablePanel = {
            text: 'Disable default information panel',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => this.setPanelVisibility(),
        } as any;

        this.settings.ctrlToggle = {
            text: 'CTRL is toggle',
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => { },
        };
    }

    init(): void {
        this.log('Initialized');
    }

    start() {
        this.setup();
        this.setPanelVisibility();
        this.log('Started');
    }

    stop() {
        this.cleanup();
        this.setPanelVisibility();
        this.log('Stopped');
    }

    ScreenMask_initializeControls() {
        this.start();
    }

    SocketManager_loggedIn() {
        this.start();
    }

    SocketManager_handleLoggedOut() {
        this.stop();
    }

    SpellMenuManager_handleSpellItemPointerOver(e, t) {
        this.spellDef = e._spellDef;
        this.ingredientBackgroundPositions = Array.from(
            e?._spellInformationContainer?._scrollsContainer?.children ?? []
        )
            .filter(recipeDiv => recipeDiv instanceof HTMLElement)
            .map(recipeDiv => {
                return (
                    Array.from(recipeDiv.children)
                        .filter(div => div instanceof HTMLElement)
                        .find(div =>
                            div.classList.contains(
                                'hs-spell-recipe-item__image'
                            )
                        )?.style?.backgroundPosition ?? ''
                );
            });

        this.setTooltipPosition({
            // NOTE: adding 20 for half of the spell button width
            x: t.X - t.OffsetX + 20,
            y: t.Y - t.OffsetY,
        });
        this.setTooltipContent();
        this.setTooltipVisibility();
    }

    SpellMenuManager_handleSpellItemPointerOut() {
        this.spellDef = null;
        this.setTooltipVisibility();
    }

    private setTooltipVisibility() {
        if (!this.tooltipDiv) return;
        if (this.settings.enable.value && this.spellDef) {
            this.tooltipDiv.className = 'visible';
        } else {
            this.tooltipDiv.className = '';
        }
    }

    private setTooltipPosition(coords: { x: number; y: number }) {
        if (!this.tooltipDiv) return;
        const x = isNaN(coords.x) ? 0 : coords.x;
        const y = isNaN(coords.y) ? 0 : coords.y;
        this.tooltipDiv.style.right = `clamp(100vw - 100cqw, 100vw - ${x + tooltipPixelWidth / 2}px, 100vw - ${tooltipPixelWidth}px)`;
        this.tooltipDiv.style.bottom = `calc(100vh - ${y - 5}px)`;
    }

    private setTooltipContent() {
        if (!this.tooltipDiv) return;
        this.tooltipDiv.innerHTML = this.makeTooltipHTML();
    }

    private makeTooltipHTML(): string {
        if (!this.spellDef) return '';
        return [
            `<div class="hl-spell-tooltip-header">
                <div class="hl-spell-tooltip-header-name" style="${this.isExpanded ? '' : 'white-space:nowrap;'}">
                    ${this.spellDef.Name}
                </div>
                <div style="flex:0;">lvl.${this.spellDef.Level}</div>
            </div>`,
            this.isExpanded &&
            `<div class="hl-spell-tooltip-description">${this.spellDef.Description}</div>`,
            this.isExpanded && this.makeTagsHTML(),
            this.isExpanded && `<hr />`,
            this.isExpanded && this.makeRequirementsHTML(),
            `<div class="hl-spell-tooltip-recipe-ctrl-container">
                ${this.makeRecipeHTML()}
                <div class="hl-spell-tooltip-ctrl" style="color:${this.isExpanded ? '#9f9fa9' : '#3f3f46'};">
                    CTRL
                </div>
            </div>`,
        ]
            .filter(html => html)
            .join('');
    }

    private makeTagsHTML(): string {
        if (!this.spellDef) return '';
        const type = this.gameLookups?.SpellTypes?.[this.spellDef.Type];
        const showType = typeof type === 'string';
        const exp = this.spellDef?.Exp;
        const showExp = typeof exp === 'number' && exp !== 0;
        const maxDamage = this.spellDef?.MaxDamage;
        const showMaxDamage = typeof maxDamage === 'number' && maxDamage !== 0;
        const showSplashDamage = (this.spellDef?.SplashDamage ?? null) !== null;
        if (
            ![showType, showExp, showMaxDamage, showSplashDamage].includes(true)
        )
            return '';
        return [
            `<div class="hl-spell-tooltip-tags">`,
            showType && `<div style="color:#71717b;">${type}</div>`,
            showExp && `<div style="color:#00a63e;">Exp: ${exp}</div>`,
            showMaxDamage &&
            `<div style="color:#ff2056;">Max DMG: ${maxDamage}</div>`,
            showSplashDamage && `<div style="color:#e60076;">Splash</div>`,
            `</div>`,
        ]
            .filter(html => html)
            .join('');
    }

    private makeRequirementsHTML(): string {
        if (!this.spellDef) return '';
        const requirements = this.spellDef.Requirements;
        if (!Array.isArray(requirements) || requirements.length < 1) return '';
        const RequirementTypes = this.gameLookups?.RequirementTypes ?? {};
        return [
            `<div class="hs-spell-tooltip-requirements">`,
            `<div>Requires</div>`,
            ...requirements.map(requirement => {
                switch (requirement.Type) {
                    case RequirementTypes.quest:
                        return this.makeQuestRequirementHTML(requirement);
                    case RequirementTypes.equippeditem:
                        return this.makeEquippedItemRequirementHTML(
                            requirement
                        );
                    default:
                        return 'unhandled requirement';
                }
            }),
            `</div>`,
            `<hr />`,
        ]
            .filter(html => html)
            .join('');
    }

    private makeQuestRequirementHTML(requirement: any): string {
        const quest = this.gameHooks?.QuestDefinitionManager?.getDefById(
            requirement?._questId
        );
        if (!quest) return 'unhandled quest';
        const isCompletionRequired =
            (quest.Checkpoints?.length ?? 0) - 1 ===
            requirement?._checkpoints?.[0];
        return [
            `<div class="hl-spell-tooltip-quest-requirement">
                <div class="hs-game-menu-bar__button__container__image hs-icon-background hs-game-menu-bar__button__container__image--quests"></div>
                <div>
                    <span class="hl-spell-tooltip-quest-requirement-name">${quest.Name}</span>
                    ${isCompletionRequired && '<span style="font-weight:normal;">completed</span>'}
                </div>
            </div>`,
        ]
            .filter(html => html)
            .join('');
    }

    private makeEquippedItemRequirementHTML(requirement: any): string {
        const items = requirement.ItemIDs?.filter(id => typeof id === 'number');
        if (!Array.isArray(items) || items.length < 1) return '';
        return items
            .map(itemID => {
                const item = this.gameHooks?.ItemDefMap?.getDefById(itemID);
                const backgroundPosition =
                    this.gameHooks?.InventoryItemSpriteManager?.getCSSBackgroundPositionForItem(
                        itemID
                    ) ?? '0rem 0rem';
                if (!item) return 'unhandled item';
                return `<div class="hl-spell-tooltip-equipped-item-requirement">
                <div class="hl-spell-tooltip-item-requirement-image" style="background-position:${backgroundPosition}"></div>
                <span class="hl-spell-tooltip-item-requirement-name">${item.NameCapitalized ?? item.Name} </span>
                equipped
            </div>`;
            })
            .filter(html => html)
            .join('');
    }

    private makeRecipeHTML(): string {
        const isBloodTeleport =
            this.spellDef?.ID ===
            (this.gameHooks?.MagicSkillManager?.BLOOD_TELEPORT_ID ?? 24);
        if (isBloodTeleport) {
            return `
                <div class="hl-spell-tooltip-recipe">
                    <div class="hs-icon-background hs-action-bar-item__image hs-action-bar-item__image--combat-skill--hitpoints hs-action-bar-item__image--combat-skill"></div>
                    &#189; Max Hitpoints
                </div>
            `;
        }
        if (this.ingredientBackgroundPositions.length < 1) {
            return '<div style="flex:1;"></div>';
        }
        return [
            `<div class="hl-spell-tooltip-recipe" style="flex-direction:${this.isExpanded ? 'column' : 'row'}">`,
            ...this.ingredientBackgroundPositions.map(
                (backgroundPosition, ingredientIndex) =>
                    this.makeIngredientHTML(backgroundPosition, ingredientIndex)
            ),
            `</div>`,
        ]
            .filter(html => html)
            .join('');
    }

    private makeIngredientHTML(
        backgroundPosition: string,
        ingredientIndex: number
    ) {
        const ingredient =
            this.spellDef?.Recipe?.Ingredients?.[ingredientIndex];
        const item = this.gameHooks?.ItemDefMap?.getDefById(ingredient?.ItemID);
        const name = item.NameCapitalized ?? item.Name ?? '';
        const amount = ingredient.Amount;
        if (!ingredient) return '';
        return [
            `<div>`,
            `<div class="hl-spell-tooltip-recipe-image" style="background-position:${backgroundPosition};"></div>`,
            amount &&
            `<span class="hl-spell-tooltip-recipe-name">${amount}</span>`,
            this.isExpanded && name,
            `</div>`,
        ]
            .filter(html => html)
            .join('');
    }

    private setPanelVisibility() {
        const panelDiv = document.querySelector(
            '#hs-magic-menu .hs-magic-menu__information-panel'
        );
        if (!panelDiv) return;
        if (this.settings.enable.value && this.settings.disablePanel.value) {
            panelDiv?.setAttribute('hl-spell-tooltip-hidden', 'true');
        } else {
            panelDiv?.removeAttribute('hl-spell-tooltip-hidden');
        }
    }

    private setup() {
        if (!this.containerDiv) {
            document.getElementById(containerId)?.remove();
            const rootContainer = document.getElementById(hsRootContainerId);
            if (!rootContainer) return;
            this.containerDiv = document.createElement('div');
            this.containerDiv.id = containerId;
            rootContainer.appendChild(this.containerDiv);
        }
        if (!this.tooltipDiv && this.containerDiv) {
            document.getElementById(tooltipId)?.remove();
            this.tooltipDiv = document.createElement('div');
            this.tooltipDiv.id = tooltipId;
            this.containerDiv.appendChild(this.tooltipDiv);
        }
        if (!document.getElementById(styleId) && this.containerDiv) {
            const styleElement = document.createElement('style');
            styleElement.id = styleId;
            styleElement.textContent = `#hl-spell-tooltip {display: ${this.isDevMode ? 'flex' : 'none'};} ${styleCss}`;
            this.containerDiv.appendChild(styleElement);
        }
        if (!this.keyDownCallback) {
            const keyDownCallback = (event: KeyboardEvent) => {
                if (!event.ctrlKey) return;
                const isExpanded = this.settings.ctrlToggle.value
                    ? !this.isExpanded
                    : true;
                if (this.isExpanded === isExpanded) return;
                this.isExpanded = isExpanded;
                this.setTooltipContent();
            };
            document.addEventListener('keydown', keyDownCallback);
            this.keyDownCallback = keyDownCallback;
        }
        if (!this.keyUpCallback) {
            const keyUpCallback = (event: KeyboardEvent) => {
                if (event.ctrlKey) return;
                if (this.settings.ctrlToggle.value) return;
                if (this.isExpanded === false) return;
                this.isExpanded = false;
                this.setTooltipContent();
            };
            document.addEventListener('keyup', keyUpCallback);
            this.keyUpCallback = keyUpCallback;
        }
    }

    private cleanup() {
        if (this.tooltipDiv) {
            this.tooltipDiv.remove();
            this.tooltipDiv = null;
        } else {
            document.getElementById(tooltipId)?.remove();
        }
        document.getElementById(styleId)?.remove();
        if (this.containerDiv) {
            this.containerDiv.remove();
            this.containerDiv = null;
        }
        const keyDownCallback = this.keyDownCallback;
        if (keyDownCallback) {
            document.removeEventListener('keydown', keyDownCallback);
            this.keyDownCallback = null;
        }
        const keyUpCallback = this.keyUpCallback;
        if (keyUpCallback) {
            document.removeEventListener('keyup', keyUpCallback);
            this.keyUpCallback = null;
        }
    }
}

export default SpellTooltipsPlugin