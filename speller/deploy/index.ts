import * as core from '@actions/core'
import * as exec from '@actions/exec'
import toml from 'toml'
import fs from 'fs'
import path from 'path'

import { divvunConfigDir, loadEnv, shouldDeploy } from '../../shared'
import { BundleType, Manifest } from '../manifest'

function pahkatPlatformFromBundleType(type: BundleType) {
    if (type == "speller_win" || type == "speller_win_mso") {
        return "windows"
    } else if (type == "speller_macos") {
        return "macos"
    } else if (type == "speller_mobile") {
        return "mobile"
    }

    throw new Error(`Invalid bundle type for Pahkat: ${type}`)
}

async function run() {
    try {
        const manifestPath = core.getInput('manifest');
        const bundleType = core.getInput('bundleType') as BundleType;
        const payload = core.getInput('payload');
        const manifest = toml.parse(fs.readFileSync(manifestPath).toString()) as Manifest

        if (!(bundleType in manifest.bundles))
            throw new Error(`No such bundle ${bundleType}`)

        let payloadMetadataString: string = ""

        const options = {
            listeners: {
                stdout: (data: Buffer) => {
                    payloadMetadataString += data.toString();
                }
            }
        }

        // Generate the payload metadata
        if (bundleType === "speller_win" || bundleType === "speller_win_mso") {
            const productCode = `{${manifest.bundles[bundleType].uuid}}`

            const exit = await exec.exec("pahkat-repomgr", [
                "payload", "windows-executable",
                "-i", "1", // TODO: get real size
                "-s", "1",
                "-k", "nsis",
                "-p", productCode,
                "-u", "pahkat:payload",
                "-r", "install,uninstall"
            ], options)

            if (exit != 0) {
                throw new Error("bundling failed")
            }
        } else if (bundleType === "speller_macos") {
            const exit = await exec.exec("pahkat-repomgr", [
                "payload", "macos-package",
                "-p", manifest.bundles.speller_macos.pkg_id!,
                "-i", "1", // TODO: get real size
                "-s", "1",
                "-u", "pahkat:payload",
                "-r", "install,uninstall",
                "-t", "system,user"
            ], options)

            if (exit != 0) {
                throw new Error("bundling failed")
            }
        } else if (bundleType === "speller_mobile") {
            const exit = await exec.exec("pahkat-repomgr", [
                "payload", "tarball-package",
                "-i", "1", // TODO: get real size
                "-s", "1",
                "-u", "pahkat:payload",
            ], options)

            if (exit != 0) {
                throw new Error("bundling failed")
            }
        } else {
            throw new Error(`Unsupported bundle type ${bundleType}`)
        }

        const bundle = manifest.bundles[bundleType]

        const payloadMetadataPath = "./payload.toml"
        fs.writeFileSync(payloadMetadataPath, payloadMetadataString, "utf8")

        const testDeploy = !!core.getInput('testDeploy') || !shouldDeploy()
        const isDeploying = !testDeploy || core.getInput('forceDeploy');
        const env = loadEnv()

        const deployScript = path.join(divvunConfigDir(), "repo", "scripts", "pahkat_deploy_new.sh")
        const exit = await exec.exec("bash", [deployScript], {
            env: {
                ...process.env,
                "DEPLOY_SVN_USER": env.svn.username,
                "DEPLOY_SVN_PASSWORD": env.svn.password,
                "DEPLOY_SVN_REPO": bundle.repo,
                "DEPLOY_SVN_PKG_ID": bundle.package,
                "DEPLOY_SVN_PKG_PLATFORM": bundle.platform || pahkatPlatformFromBundleType(bundleType),
                "DEPLOY_SVN_PKG_PAYLOAD": path.resolve(payload),
                "DEPLOY_SVN_PKG_PAYLOAD_METADATA": path.resolve(payloadMetadataPath),
                "DEPLOY_SVN_PKG_VERSION": manifest.package.version,
                // TODO: Meh
                "DEPLOY_SVN_REPO_ARTIFACTS": "https://pahkat.uit.no/artifacts/",
                "DEPLOY_SVN_COMMIT": isDeploying ? "1" : ""
            }
        });

        if (exit != 0) {
            throw new Error("deploy failed")
        }
    }
    catch (error) {
        core.setFailed(error.message);
    }
}

run()