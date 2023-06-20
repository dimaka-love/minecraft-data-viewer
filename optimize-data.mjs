//@ts-check
import fs from 'fs'
import * as semver from 'semver'
import { getTexturesPath } from './mc-data-shared.cjs'
import { groupBy } from 'rambda'

const { texturesPath } = getTexturesPath()

const models = await import(texturesPath + 'blocks_models.json', {
    assert: {
        type: 'json',
    },
})
const textures = await import(texturesPath + 'blocks_textures.json', {
    assert: {
        type: 'json',
    },
})

// groupBy(([target, {parent, textures}]) => , Object.entries(models))

// console.log(textures.filter(({name, blockState, model, texture}) => name !== blockState || `minecraft:${blockState}` !== model || ))
