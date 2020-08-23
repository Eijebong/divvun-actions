"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const path_1 = __importDefault(require("path"));
const shared_1 = require("../shared");
const delay = (ms) => new Promise((resolve) => setTimeout(() => resolve(), ms));
async function run() {
    const filePath = path_1.default.resolve(core.getInput('path', { required: true }));
    const fileName = filePath.split(path_1.default.sep).pop();
    const sec = shared_1.secrets();
    if (process.platform == "win32") {
        await exec.exec("signtool.exe", [
            "sign", "/t", "http://timestamp.verisign.com/scripts/timstamp.dll",
            "/f", shared_1.DIVVUN_PFX, "/p", sec.windows.pfxPassword,
            filePath
        ]);
    }
    else if (process.platform === "darwin") {
        const { developerAccount, appPassword, appCodeSignId } = sec.macos;
        await exec.exec("codesign", ["-s", appCodeSignId, filePath, "--timestamp", "--options=runtime"]);
        const zipPath = path_1.default.resolve(path_1.default.dirname(filePath), "upload.zip");
        await exec.exec("ditto", ["-c", "-k", "--keepParent", filePath, zipPath]);
        const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
        const fakeBundleId = `com.github.${owner}.${repo}.${fileName}.zip`;
        const response = JSON.parse((await shared_1.Bash.runScript(`xcrun altool --notarize-app\
 --primary-bundle-id ${fakeBundleId}\
 --username "${developerAccount}"\
 --password "${appPassword}"\
 --output-format json
 --file ${zipPath}`)).join("\n"));
        console.log(JSON.stringify(response, null, 2));
        const requestUuid = response["notarization-upload"].RequestUUID;
        for (;;) {
            console.log("Waiting 10 seconds...");
            await delay(10000);
            console.log("Polling for status...");
            const response = JSON.parse((await shared_1.Bash.runScript(`xcrun altool\
 --notarization-info ${requestUuid}\
 -u "${developerAccount}"\
 -p ${appPassword}"\
 --output-format json`)).join("\n"));
            console.log(JSON.stringify(response, null, 2));
            const status = response["notarization-info"].Status;
            if (status === "success") {
                console.log("Success!");
                break;
            }
            else if (status === "in progress") {
                console.log("In progress...");
            }
            else {
                throw new Error(`Got failure status: ${status}`);
            }
        }
    }
    else {
        throw new Error("Unsupported platform: " + process.platform);
    }
}
run().catch(err => {
    console.error(err.stack);
    process.exit(1);
});
