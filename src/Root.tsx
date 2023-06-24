import { CSSProperties, ComponentProps, useEffect, useMemo, useRef, useState } from 'react'
import { getItemTexture, items, recipes } from './mcData'
import { proxy, useSnapshot, subscribe } from 'valtio'
import { usePopper } from 'react-popper'
import { equals, splitEvery } from 'rambda'
import { Icon } from '@iconify/react'
import gridOn from '@iconify-icons/mdi/grid-on'
import viewList from '@iconify-icons/mdi/view-list'
import menu from '@iconify-icons/mdi/menu'

type Slot = readonly [id: number, quantity: number] | undefined
type SlotDefined = Exclude<Slot, undefined>

const INVENTORY_ROW_COUNT = 9
const INVENTORY_ROWS = 3

const slots = proxy({
    // todo?
    inputSlots: [[143, 1], ...new Array(8).fill(undefined)] as Slot[],
    blockOutput: [] as Slot[],
    inventory: new Array(INVENTORY_ROW_COUNT * (INVENTORY_ROWS + 1)) as Slot[],
})

const machineConfiguration = {
    inputSlotsNumber: 9,
    outputBlockGlob(index: number) {
        if (slots.blockOutput[index] !== undefined) return
        slots.inputSlots.forEach((blockSlot, i) => {
            if (!blockSlot || blockSlot[1] <= 1) {
                slots.inputSlots.splice(i, 1, undefined)
                return
            }
            //@ts-ignore
            blockSlot[1]--
        })
    },
}

const resetMachine = () => {
    slots.inputSlots = new Array(machineConfiguration.inputSlotsNumber).fill(undefined)
}

// resetMachine()

let lastClickEventCoords: { clientX: number; clientY: number }
const draggingSlot = proxy({
    slot: undefined as Slot,
})

subscribe(slots.inputSlots, e => {
    const resultingRecipe = getResultingRecipe()
    slots.blockOutput = [resultingRecipe]
})

const currentView = proxy({
    type: 'crafting' as 'crafting' | 'items-list' | 'recipes-list',
})

type SlotType = keyof typeof slots

const SLOT_BG = '#616161'
const SLOT_SIZE = 40
const isTouchDevice = navigator.maxTouchPoints > 0

const allItems = items
    .map((item): SlotDefined => {
        return [item.id, 0]
    })
    // skip air
    .slice(1)

const pushItem = (slotType: SlotType, item: SlotDefined) => {
    const rows = splitEvery(INVENTORY_ROW_COUNT, slots[slotType])
    const data = getItemDataById(item[0])
    let innerIndex = -1
    // todo
    // let pushAnother
    let pushRowIndex = rows.findIndex(row => {
        innerIndex = row.findIndex(slot => slot === undefined || (slot[0] === item[0] && slot[1] + item[1] <= data.stackSize))
        return innerIndex !== -1
    })
    if (pushRowIndex === -1) return false
    if (rows[pushRowIndex]![innerIndex]!) {
        //@ts-ignore
        slots[slotType][pushRowIndex * INVENTORY_ROW_COUNT + innerIndex]![1] += item[1]
    } else {
        slots[slotType][pushRowIndex * INVENTORY_ROW_COUNT + innerIndex] = item
    }
    return true
}

const hoverFocusableProxy = proxy({
    value: false,
})

addEventListener('keydown', ({ altKey }) => {
    // todo check other!
    if (altKey) {
        hoverFocusableProxy.value = true
    }
})
addEventListener('keyup', ({ altKey }) => {
    // todo check other!
    if (altKey) {
        hoverFocusableProxy.value = false
    }
})

const fillInMissing = <T extends any, B>(arr: T[], value: B, length: number): (T | B)[] => {
    for (let i = 0; i < length; i++) {
        if (!(i in arr)) {
            arr[i] = value as unknown as T
        }
    }
    return arr
}

const allRecipes = Object.values(recipes)
    .map(variants => {
        const variant = variants[0]!
        const input =
            variant.ingredients ||
            variant.inShape!.flatMap(row =>
                fillInMissing(
                    row.map(id => (id === null ? undefined : id)),
                    undefined,
                    3,
                ),
            )
        if (input.find(x => x !== undefined && typeof x !== 'number')) throw new Error('Recipe looks weird.')
        if ((!variant.inShape && !variant.ingredients) || typeof variant.result.id !== 'number') throw new Error('Incorrect recipe!')
        return { input, output: [variant.result.id, variant.result.count] as Slot }
    })
    .map(({ input, output }) => ({
        input: fillInMissing(
            input.map(id => (id === undefined ? undefined : ([id, 0] as Slot))),
            undefined,
            9,
        ),
        output,
    }))

export default () => {
    const { slot: draggingItem } = useSnapshot(draggingSlot)

    const slotsData = useSnapshot(slots)
    const displayView = useSnapshot(currentView)
    const [search, setSearch] = useState('')
    const inputRef = useRef<HTMLInputElement>(null!)
    const [draggingEl, setDraggingEl] = useState(null as HTMLDivElement | null)

    useEffect(() => {
        setSearch('')
        if (displayView.type === 'items-list' && !isTouchDevice) inputRef.current.focus()
    }, [displayView])

    useEffect(() => {
        const el = draggingEl
        if (!el) return
        const controller = new AbortController()
        document.addEventListener(
            'pointermove',
            e => {
                el.style.left = e.clientX - SLOT_SIZE / 2 + 'px'
                el.style.top = e.clientY - SLOT_SIZE / 2 + 'px'
            },
            {
                signal: controller.signal,
            },
        )
        document.dispatchEvent(new MouseEvent('pointermove', lastClickEventCoords))
        setTimeout(() => {
            document.addEventListener(
                'pointerdown',
                e => {
                    const el = (e.target as HTMLDivElement).closest('.slot') as HTMLDivElement
                    if (!el) return
                    const { slotIndex } = el.dataset
                    const slotType = el.dataset.slotType as SlotType
                    if (!slotType || slotType === 'blockOutput') return
                    const thatSlot: Slot = slots[slotType!][slotIndex!]
                    if (thatSlot) {
                        if (thatSlot[0] === draggingSlot.slot![0]) {
                            //@ts-expect-error readonly
                            thatSlot[1] += draggingSlot.slot![1]
                            draggingSlot.slot = undefined
                        } else {
                            return
                        }
                    } else {
                        slots[slotType!][slotIndex!] = draggingSlot.slot
                        draggingSlot.slot = undefined
                    }
                    controller.abort()
                },
                {
                    signal: controller.signal,
                },
            )
        })
    }, [draggingEl])

    return (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div
                style={{
                    width: 600,
                    height: 400,
                    display: 'flex',
                    flexDirection: 'column',
                    // justifyContent: 'center',
                    // alignItems: 'center',
                    background: '#a4a4a4',
                    paddingTop: 20,
                    paddingLeft: 5,
                }}
            >
                <div style={{ marginBottom: 20 }}>
                    <IconButton icon={gridOn} onClick={() => (currentView.type = 'crafting')} />
                    <IconButton icon={viewList} onClick={() => (currentView.type = 'recipes-list')} />
                    <IconButton icon={menu} onClick={() => (currentView.type = 'items-list')} />
                </div>
                {displayView.type === 'crafting' && (
                    <>
                        <CraftingView
                            inputSlots={Array.from({ length: 3 }).map((_, i) => (
                                <SlotsRow count={3} key={i} data={{ slotsType: 'inputSlots' }} row={i} />
                            ))}
                            outputSlot={<Slot item={slotsData.blockOutput[0]} action={{ drag: { type: 'blockOutput', index: 0 } }} />}
                        />
                        <div style={{ marginTop: 40 }}>
                            {Array.from({ length: INVENTORY_ROWS }).map((_, i) => (
                                <SlotsRow key={i} count={INVENTORY_ROW_COUNT} data={{ slotsType: 'inventory' }} row={i} />
                            ))}
                        </div>
                    </>
                )}
                {displayView.type === 'recipes-list' && (
                    <div style={{ overflow: 'auto' }}>
                        {allRecipes.map((recipe, i) => (
                            <CraftingView
                                key={i}
                                inputSlots={Array.from({ length: 3 }).map((_, i) => (
                                    <SlotsRow count={3} key={i} data={recipe.input} row={i} />
                                ))}
                                outputSlot={<Slot item={recipe.output} />}
                            />
                        ))}
                    </div>
                )}
                {displayView.type === 'items-list' && (
                    <>
                        <div>
                            <input
                                value={search}
                                ref={inputRef}
                                onChange={({ target: { value } }) => setSearch(value)}
                                autoComplete="false"
                                style={{ background: SLOT_BG, outline: 'none', fontSize: '1.2em', color: 'whitesmoke' }}
                            />
                        </div>
                        <div>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <SlotsRow
                                    key={i}
                                    count={INVENTORY_ROW_COUNT}
                                    data={allItems.filter(([itemId]) => {
                                        if (!search) return true
                                        const item = getItemDataById(itemId)
                                        return item.displayName.toLowerCase().includes(search.toLowerCase()) || item.id === +search
                                    })}
                                    row={i}
                                    action={([itemId], event) => {
                                        pushItem('inventory', [itemId, event.altKey ? getItemDataById(itemId).stackSize : 1])
                                        currentView.type = 'crafting'
                                    }}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
            {draggingItem && (
                <div
                    style={{
                        position: 'fixed',
                        pointerEvents: 'none',
                    }}
                    ref={setDraggingEl}
                >
                    <ItemTexture item={draggingItem} />
                </div>
            )}
        </div>
    )
}

const CraftingView = ({ inputSlots, outputSlot }) => {
    return (
        <div style={{ display: 'flex' }}>
            <div>{inputSlots}</div>
            <div style={{ width: SLOT_SIZE, aspectRatio: 1, display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: SLOT_SIZE, height: SLOT_SIZE / 3, marginRight: 5, background: SLOT_BG }} />
                    {outputSlot}
                </div>
            </div>
        </div>
    )
}

const SlotsRow: React.FC<
    ComponentProps<'div'> & {
        row: number
        count: number
        data: readonly Slot[] | { slotsType: SlotType }
        action?: SlotActionCallback
    }
> = ({ count, style, row = 0, data, action, ...props }) => {
    const slotsType = (data as Exclude<typeof data, readonly any[]>).slotsType
    const slotsData = slotsType ? useSnapshot(slots) : undefined

    return (
        <div style={{ display: 'flex', ...style }} {...props}>
            {Array.from({ length: count }).map((_, i) => {
                const index = row * count + i
                return (
                    <Slot
                        item={slotsData ? slotsData[slotsType][index] : data[index]}
                        action={
                            action ||
                            (slotsType
                                ? {
                                      drag: {
                                          index,
                                          type: (data as Exclude<typeof data, readonly any[]>).slotsType,
                                      },
                                  }
                                : undefined)
                        }
                        key={i}
                    />
                )
            })}
        </div>
    )
}

const getResultingRecipe = (): Slot => {
    const inputSlotsItems = slots.inputSlots.map(blockSlot => blockSlot?.[0])
    let currentShape = splitEvery(3, inputSlotsItems as (number | undefined | null)[]) /* .filter(row => row.some(slot => slot !== undefined)) */
    // todo rewrite with cadidates search
    if (currentShape.length > 1) {
        for (const slotX in currentShape[0]) {
            if (currentShape[0][slotX] !== undefined) {
                for (const otherY of [1, 2]) {
                    if (currentShape[otherY]?.[slotX] === undefined) {
                        currentShape[otherY]![slotX] = null
                    }
                }
            }
        }
    }
    currentShape = currentShape.map(arr => arr.filter(x => x !== undefined)).filter(x => x.length !== 0)

    const slotsIngredients = [...inputSlotsItems].sort().filter(item => item !== undefined)
    type Result = { id: number; count: number } | undefined
    let shapelessResult: Result
    let shapeResult: Result
    outer: for (const [id, recipeVariants] of Object.entries(recipes)) {
        for (const recipeVariant of recipeVariants) {
            if (equals(currentShape, recipeVariant.inShape)) {
                shapeResult = recipeVariant.result
                break outer
            }
            if (equals(slotsIngredients, recipeVariant.ingredients?.sort())) {
                shapelessResult = recipeVariant.result
                break outer
            }
        }
    }
    const result = shapeResult ?? shapelessResult
    if (!result) return
    return [result.id, result.count]
}

const getItemDataById = (id: number) => {
    const item = items.find(item => item.id === id)!
    return { ...item }
}

type SlotActionCallback = (item: SlotDefined, event: PointerEvent) => any

const Slot = ({ item, action }: { item: Slot; action?: { drag: { type: SlotType; index: number } } | SlotActionCallback }) => {
    const [referenceElement, setReferenceElement] = useState<HTMLDivElement | null>(null)
    const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
    const [arrowElement, setArrowElement] = useState<HTMLDivElement | null>(null)
    const [hovered, setHovered] = useState(false)
    const hoverFocusable = useSnapshot(hoverFocusableProxy)

    const { styles, attributes } = usePopper(referenceElement, popperElement, {
        modifiers: [{ name: 'arrow', options: { element: arrowElement, padding: 5 } }],
    })

    const { drag: actionDrag } = typeof action === 'object' ? action : { drag: undefined }

    const itemData = useMemo(() => {
        return item ? getItemDataById(item[0]) : undefined
    }, [item])

    return (
        <div
            data-slot-type={actionDrag?.type}
            data-slot-index={actionDrag?.index}
            style={{ width: SLOT_SIZE, aspectRatio: 1, background: SLOT_BG, marginRight: 3, marginBottom: 3, border: '1px solid black' }}
            className="slot"
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
        >
            {itemData && hovered && (
                // todo make proxy, only one in state
                <div
                    ref={setPopperElement}
                    style={{
                        ...styles.popper,
                        color: 'white',
                        background: 'black',
                        userSelect: 'text',
                        pointerEvents: hoverFocusable.value ? undefined : 'none',
                        zIndex: 100,
                    }}
                    {...attributes.popper}
                >
                    {itemData.displayName} (#{item})
                    <div ref={setArrowElement} style={styles.arrow} />
                </div>
            )}
            {item && (
                <div
                    ref={setReferenceElement}
                    style={{
                        width: SLOT_SIZE,
                        height: SLOT_SIZE,
                    }}
                    onPointerDown={event => {
                        if (!action) return
                        if (draggingSlot.slot) return
                        if (typeof action === 'function') {
                            action(item!, event as unknown as PointerEvent)
                            return
                        }
                        const { clientX, clientY } = event
                        lastClickEventCoords = { clientX, clientY }
                        const { type, index } = action.drag
                        const [itemId, quantity] = slots[type][index]!
                        const reduceSlotQuantity = (by: number) => {
                            const restSize = quantity - by
                            slots[type][index] = restSize === 0 ? undefined : [itemId, restSize]
                        }

                        if (event.button === 2) {
                            const halfSize = Math.ceil(slots[type][index]![1] / 2)
                            draggingSlot.slot = [itemId, halfSize]
                            reduceSlotQuantity(halfSize)
                        } else if (event.ctrlKey) {
                            if (pushItem('inventory', [itemId, 1])) {
                                reduceSlotQuantity(1)
                            }
                        } else if (event.altKey) {
                            draggingSlot.slot = [itemId, itemData!.stackSize]
                        } else {
                            draggingSlot.slot = slots[type][index]
                            slots[type][index] = undefined
                        }
                        if (action.drag.type === 'blockOutput') {
                            machineConfiguration.outputBlockGlob(action.drag.index)
                        }
                    }}
                >
                    <ItemTexture item={item} itemName={itemData?.name} />
                </div>
            )}
        </div>
    )
}

const ItemTexture = ({ item, itemName = undefined! as string, style = undefined as CSSProperties | undefined }) => {
    const texturePath = useMemo(() => {
        if (!item) return
        return getItemTexture(item[0], itemName ?? getItemDataById(item[0]).name)
    }, [item])
    if (!item) return null

    return (
        <div
            style={{
                width: SLOT_SIZE,
                height: SLOT_SIZE,
                position: 'relative',
                ...(style ?? {}),
            }}
        >
            <img
                alt={itemName}
                draggable="false"
                style={{
                    width: '100%',
                    height: '100%',
                    imageRendering: 'pixelated',
                    overflow: 'hidden',
                    ...(texturePath?.isBlock
                        ? {
                              width: 'calc(100% - 8px)',
                              height: 'calc(100% - 8px)',
                              maxWidth: SLOT_SIZE, // workaround so alt text is clipped
                              paddingTop: 4,
                              paddingLeft: 4,
                              //   border: '2px solid brown',
                          }
                        : {}),
                }}
                src={import.meta.env.VITE_TEXTURES + texturePath?.path}
            />
            {item[1] ? <span style={{ position: 'absolute', bottom: 0, right: 0, marginBottom: -3 }}>{item[1]}</span> : undefined}
        </div>
    )
}

function IconButton({ icon, onClick }: { icon; onClick }) {
    return <Icon icon={icon} style={{ fontSize: 40, color: 'white', border: '1px solid gray', marginRight: 3, background: '#858585' }} onClick={onClick} />
}

addEventListener('contextmenu', e => {
    e.preventDefault()
})
