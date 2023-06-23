import { defineVitConfig } from '@zardoy/vit'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { getTexturesPath } from './mc-data-shared.cjs'

//@ts-ignore
const json = require('minecraft-data/minecraft-data/data/dataPaths.json')

const [version, files] = Object.entries(json.pc).slice(-1)[0] as any

const { texturesPath, texturesVer } = getTexturesPath()

console.log(`Using data of MC ${version}`)
console.log(`Using textures of MC ${texturesVer}`)

export default defineConfig((...args) => {
    const { mode } = args[0]
    return defineVitConfig({
        resolve: {
            alias: {
                ...Object.fromEntries(
                    ['recipes', 'items', 'blocks'].map(file => [`mc_${file}`, `minecraft-data/minecraft-data/data/${files[file]}/${file}.json`]),
                ),
                mc_textures: texturesPath,
            },
        },
        defineEnv: {
            VITE_TEXTURES: mode === 'production' ? 'textures/' + texturesVer + '/' : texturesPath,
        },
        // assetsInclude: [texturesPath + 'items/*.png'],
        plugins: [
            viteStaticCopy({
                targets: [
                    {
                        src: texturesPath,
                        dest: 'textures',
                    },
                ],
            }),
        ],
    })(...args)
})
