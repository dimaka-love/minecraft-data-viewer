//@ts-ignore
import _items from 'mc_items'
//@ts-ignore
import _blocks from 'mc_blocks'
//@ts-ignore
import _recipes from 'mc_recipes'
//@ts-ignore
import blocksModels from 'mc_textures/blocks_models.json'

export const items = _items as { id: number; name: string; displayName: string; stackSize }[]
export const blocks = _blocks as Record<string, any>[]
export const recipes = _recipes as Record<string, { inShape?; ingredients?: number[]; result: { id; count } }[]>

const blocksNames = blocks.map(block => block.name)

export const getItemTexture = (itemId: number, name: string) => {
    const isBlock = blocksNames.includes(name)
    const blockTextures = blocksModels[name]?.textures
    const textureName = blockTextures?.side ?? name
    return { path: `${isBlock ? 'blocks' : 'items'}/${textureName.replace(/^(minecraft:)?block\//, '')}.png`, isBlock }
}
