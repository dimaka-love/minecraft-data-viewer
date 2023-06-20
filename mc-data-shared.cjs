//@ts-check
const fs = require('fs')
const semver = require('semver')

module.exports.getTexturesPath = () => {
    const texturesBase = './node_modules/minecraft-assets/minecraft-assets/data/'
    const normalizeSemver = ver => {
        const str = semver.validRange(ver)
        if (!str) return '0.0.0'
        return str?.startsWith('>=') ? str.slice('>='.length, str.indexOf(' ')) : str
    }

    const texturesVer = fs
        .readdirSync(texturesBase)
        .sort((a, b) => semver.compare(normalizeSemver(a), normalizeSemver(b)))
        .reverse()[0]

    return {
        texturesVer,
        texturesPath: texturesBase + texturesVer + '/',
    }
}
