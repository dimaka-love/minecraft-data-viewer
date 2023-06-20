import { ComponentProps, useEffect, useMemo, useRef, useState } from 'react'
import { blocks, getItemTexture, items, recipes } from './mcData'
import { proxy, useSnapshot, subscribe } from 'valtio'
import { usePopper } from 'react-popper'
import { equals, splitEvery } from 'rambda'
import { Icon } from '@iconify/react'
import gridOn from '@iconify-icons/mdi/grid-on'
import viewList from '@iconify-icons/mdi/view-list'
import menu from '@iconify-icons/mdi/menu'

type Slot = number | undefined

const slots = proxy({
    blockSlots: [143] as Slot[],
    blockOutput: [] as Slot[],
    inventory: [] as Slot[],
})

subscribe(slots.blockSlots, e => {
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

let dragActive = false

const allItems = items.map((item): Exclude<Slot, undefined> => {
    return item.id
})

const pushItem = (slotType: SlotType, itemId: number) => {
    const slotsType = slots[slotType]
    const undIdx = slotsType.indexOf(undefined)
    const pushItem = itemId
    if (undIdx === -1) {
        slotsType.push(pushItem)
    } else {
        slotsType.splice(undIdx, 1, pushItem)
    }
}

export default () => {
    const slotsData = useSnapshot(slots)
    const displayView = useSnapshot(currentView)
    const [search, setSearch] = useState('')
    const inputRef = useRef<HTMLInputElement>(null!)

    useEffect(() => {
        setSearch('')
        if (displayView.type === 'items-list' && !isTouchDevice) inputRef.current.focus()
    }, [displayView])

    return (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div
                style={{
                    width: 600,
                    height: 400,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    // alignItems: 'center',
                    background: '#a4a4a4',
                }}
            >
                <div style={{ marginBottom: 20 }}>
                    <Icon icon={gridOn} style={{ fontSize: 40, color: 'white' }} onClick={() => (currentView.type = 'crafting')} />
                    <Icon icon={viewList} style={{ fontSize: 40, color: 'white' }} onClick={() => (currentView.type = 'recipes-list')} />
                    <Icon icon={menu} style={{ fontSize: 40, color: 'white' }} onClick={() => (currentView.type = 'items-list')} />
                </div>
                {displayView.type === 'crafting' && (
                    <>
                        <div style={{ display: 'flex' }}>
                            <div>
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <SlotsRow count={3} key={i} data={{ slotsType: 'blockSlots' }} row={i} />
                                ))}
                            </div>
                            <div style={{ width: SLOT_SIZE, aspectRatio: 1, display: 'flex', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <div style={{ width: SLOT_SIZE, height: SLOT_SIZE / 3, marginRight: 5, background: SLOT_BG }} />
                                    <Slot itemId={slotsData.blockOutput[0]} action={{ drag: { type: 'blockOutput', index: 0 } }} />
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: 40 }}>
                            {Array.from({ length: 3 }).map((_, i) => (
                                <SlotsRow key={i} count={9} data={{ slotsType: 'inventory' }} row={i} />
                            ))}
                        </div>
                    </>
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
                                    count={9}
                                    data={allItems.filter(itemId => {
                                        if (!search) return true
                                        const item = getItemDataById(itemId)
                                        return item.displayName.toLowerCase().includes(search.toLowerCase()) || item.id === +search
                                    })}
                                    row={i}
                                    action={itemId => {
                                        pushItem('inventory', itemId)
                                        currentView.type = 'crafting'
                                    }}
                                />
                            ))}
                        </div>
                    </>
                )}
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
                        itemId={slotsData ? slotsData[slotsType][index] : data[index]}
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

const getResultingRecipe = () => {
    const currentShape = splitEvery(3, slots.blockSlots)
        .map(arr => arr.filter(x => x !== undefined))
        .filter(arr => arr.length !== 0)
    const slotsIngredients = [...slots.blockSlots].sort().filter(item => item !== undefined)
    type Result = { id; count } | undefined
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
    return shapeResult?.id ?? shapelessResult?.id
}

const getItemDataById = (id: number) => {
    const item = items.find(item => item.id === id)!
    return { ...item }
}

type SlotActionCallback = (itemId: number) => any

const Slot = ({ itemId, action }: { itemId: Slot; action?: { drag: { type: SlotType; index: number } } | SlotActionCallback }) => {
    const [referenceElement, setReferenceElement] = useState<HTMLDivElement | null>(null)
    const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
    const [arrowElement, setArrowElement] = useState<HTMLDivElement | null>(null)
    const [hovered, setHovered] = useState(false)

    const { styles, attributes } = usePopper(referenceElement, popperElement, {
        modifiers: [{ name: 'arrow', options: { element: arrowElement, padding: 5 } }],
    })

    const [dragging, setDragging] = useState(undefined as undefined | number)
    const { drag: actionDrag } = typeof action === 'object' ? action : { drag: undefined }

    const itemData = useMemo(() => {
        return itemId ? getItemDataById(itemId) : undefined
    }, [itemId])

    return (
        <div
            data-slot-type={actionDrag?.type}
            data-slot-index={actionDrag?.index}
            style={{ width: SLOT_SIZE, aspectRatio: 1, background: SLOT_BG, marginRight: 3, marginBottom: 3, border: '1px solid black' }}
            className="slot"
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
        >
            {itemData && hovered && !dragging && (
                <div ref={setPopperElement} style={{ ...styles.popper, color: 'white', background: 'black', userSelect: 'text' }} {...attributes.popper}>
                    {itemData.displayName} (#{itemId})
                    <div ref={setArrowElement} style={styles.arrow} />
                </div>
            )}
            {(itemId || dragging) && (
                // todo portal it and remove slot here
                <div
                    ref={setReferenceElement}
                    className="item-draggable"
                    style={{
                        width: SLOT_SIZE,
                        height: SLOT_SIZE,
                        aspectRatio: 1,
                        // background: 'red',
                        position: dragging ? 'fixed' : undefined,
                        pointerEvents: dragging ? 'none' : undefined,
                        // cursor: dragging ? 'none' : undefined,
                    }}
                    onPointerDown={({ currentTarget: _currentTarget }) => {
                        if (dragActive) return
                        if (typeof action === 'function') {
                            action(itemId!)
                            return
                        }
                        dragActive = true
                        const { type, index } = actionDrag!
                        const oldSlot = slots[type][index]
                        const el = _currentTarget as HTMLDivElement
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
                        setTimeout(() => {
                            document.addEventListener(
                                'pointerdown',
                                e => {
                                    const el = e.target as HTMLDivElement
                                    if (!el) return
                                    const { slotType, slotIndex } = el.dataset
                                    if (!slotType || (slotType as SlotType) === 'blockOutput') return
                                    slots[type][index] = undefined
                                    slots[slotType!][slotIndex!] = oldSlot
                                    controller.abort()
                                    setDragging(undefined)
                                    dragActive = false
                                },
                                {
                                    signal: controller.signal,
                                },
                            )
                        })
                        setDragging(oldSlot)
                    }}
                >
                    <ItemTexture itemId={itemId} itemName={itemData?.name} />
                </div>
            )}
        </div>
    )
}

const ItemTexture = ({ itemId, itemName = undefined! as string, style = undefined }) => {
    const texturePath = useMemo(() => {
        if (!itemId) return
        return getItemTexture(itemId, itemName ?? getItemDataById(itemId).name)
    }, [itemId])
    if (!itemId) return null

    return (
        <img
            alt={itemName}
            draggable="false"
            style={{
                width: '100%',
                height: '100%',
                imageRendering: 'pixelated',
                ...(style ?? {}),
                ...(texturePath?.isBlock
                    ? {
                          width: 'calc(100% - 8px)',
                          height: 'calc(100% - 8px)',
                          paddingTop: 4,
                          paddingLeft: 4,
                          //   border: '2px solid brown',
                      }
                    : {}),
            }}
            src={import.meta.env.VITE_TEXTURES + texturePath?.path}
        />
    )
}
