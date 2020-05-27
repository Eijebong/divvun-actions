"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const github = __importStar(require("@actions/github"));
var SpellerType;
(function (SpellerType) {
    SpellerType["MacOS"] = "speller-macos";
    SpellerType["Mobile"] = "speller-mobile";
    SpellerType["Windows"] = "speller-windows";
    SpellerType["WindowsMSOffice"] = "speller-windows-msoffice";
})(SpellerType = exports.SpellerType || (exports.SpellerType = {}));
function deriveLangTag(force3) {
    const lang = github.context.repo.repo.split("lang-")[1];
    if (force3) {
        return lang;
    }
    if (lang == "sme") {
        return "se";
    }
    return lang;
}
exports.deriveLangTag = deriveLangTag;
function derivePackageId(type) {
    const lang = github.context.repo.repo.split("lang-")[1];
    if (type == SpellerType.WindowsMSOffice) {
        return `speller-${lang}-mso`;
    }
    return `speller-${lang}`;
}
exports.derivePackageId = derivePackageId;
