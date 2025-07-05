import { run, web3 } from "hardhat";
import { TFLStopPointListInstance } from "../typechain-types";
import { prepareAttestationRequestBase, retrieveDataAndProofBaseWithRetry, submitAttestationRequest } from "./Base";

const TFLStopPointList = artifacts.require("TFLStopPointList");

const { WEB2JSON_VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

// yarn hardhat run scripts/fdcExample/Web2Json.ts --network coston2

// Request data
// const apiUrl = "https://swapi.dev/api/people/3/";
const apiUrl = "https://api.tfl.gov.uk/StopPoint/Mode/dlr";
const postProcessJq = `.stopPoints[] | .lat = (.lat * 100000 | trunc)| .lon = (.lon * 100000 | trunc) | { naptanId, lat, lon, commonName }`;
const httpMethod = "GET";
// Defaults to "Content-Type": "application/json"
const headers = "{}";
const queryParams = "{}";
const body = "{}";
const abiSignature = `{"components": [{"internalType": "int256","name": "lat","type": "int256"},{"internalType": "int256","name": "lon","type": "int256"},{"internalType": "string","name": "commonName","type": "string"},{"internalType": "string","name": "naptanId","type": "string"}],"internalType": "struct DataTransportObject","name": "dto","type": "tuple"}`;

// Configuration constants
const attestationTypeBase = "Web2Json";
const sourceIdBase = "PublicWeb2";
const verifierUrlBase = WEB2JSON_VERIFIER_URL_TESTNET;

async function prepareAttestationRequest(apiUrl: string, postProcessJq: string, abiSignature: string) {
    const requestBody = {
        url: apiUrl,
        httpMethod: httpMethod,
        headers: headers,
        queryParams: queryParams,
        body: body,
        postProcessJq: postProcessJq,
        abiSignature: abiSignature,
    };

    const url = `${verifierUrlBase}Web2Json/prepareRequest`;
    const apiKey = VERIFIER_API_KEY_TESTNET;

    return await prepareAttestationRequestBase(url, apiKey, attestationTypeBase, sourceIdBase, requestBody);
}

async function retrieveDataAndProof(abiEncodedRequest: string, roundId: number) {
    const url = `${COSTON2_DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
    console.log("Url:", url, "n");
    return await retrieveDataAndProofBaseWithRetry(url, abiEncodedRequest, roundId);
}

async function deployAndVerifyContract() {
    const args: any[] = [];
    const characterList: TFLStopPointListInstance = await TFLStopPointList.new(...args);
    try {
        await run("verify:verify", {
            address: characterList.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log("TFLStopPointList deployed to", characterList.address, "\n");
    return characterList;
}

async function interactWithContract(characterList: TFLStopPointListInstance, proof: any) {
    console.log("Proof hex:", proof.response_hex, "\n");

    // A piece of black magic that allows us to read the response type from an artifact
    const IWeb2JsonVerification = await artifacts.require("IWeb2JsonVerification");
    const responseType = IWeb2JsonVerification._json.abi[0].inputs[0].components[1];
    console.log("Response type:", responseType, "\n");

    const decodedResponse = web3.eth.abi.decodeParameter(responseType, proof.response_hex);
    console.log("Decoded proof:", decodedResponse, "\n");
    const transaction = await characterList.addCharacter({
        merkleProof: proof.proof,
        data: decodedResponse,
    });
    console.log("Transaction:", transaction.tx, "\n");
    console.log("Star Wars Characters:\n", await characterList.getAllCharacters(), "\n");
}

async function main() {
    const data = await prepareAttestationRequest(apiUrl, postProcessJq, abiSignature);
    console.log("Data:", data, "\n");

    const abiEncodedRequest = data.abiEncodedRequest;
    const roundId = await submitAttestationRequest(abiEncodedRequest);

    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);

    const characterList: TFLStopPointListInstance = await deployAndVerifyContract();

    await interactWithContract(characterList, proof);
}

void main().then(() => {
    process.exit(0);
});
