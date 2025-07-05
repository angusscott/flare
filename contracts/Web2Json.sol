// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IWeb2Json} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";

    struct TFLStopPoint {
        int256 latitude;
        int256 longitude;
        string name;
        string id;
    }

    struct DataTransportObject {
        int256 lat;
        int256 lon;
        string commonName;
        string naptanId;
    }

interface ITFLStopPointList {
    function addCharacter(IWeb2Json.Proof calldata data) external;
    function getAllCharacters()
    external
    view
    returns (TFLStopPoint[] memory);
}

contract TFLStopPointList {
    mapping(string => TFLStopPoint) public stops;
    string[] public naptanIds;

    function addCharacter(IWeb2Json.Proof calldata data) public {
        require(isJsonApiProofValid(data), "Invalid proof");

        DataTransportObject memory dto = abi.decode(
            data.data.responseBody.abiEncodedData,
            (DataTransportObject)
        );

        require(
            keccak256(bytes(stops[dto.naptanId].id)) == keccak256(bytes("")),
            "Naptan Id already exists"
        );

        TFLStopPoint memory stop = TFLStopPoint({
            latitude: dto.lat,
            longitude: dto.lon,
            name: dto.commonName,
            id: dto.naptanId
        });

        stops[dto.naptanId] = stop;
        naptanIds.push(dto.naptanId);
    }

    function getAllCharacters()
    public
    view
    returns (TFLStopPoint[] memory)
    {
        TFLStopPoint[] memory result = new TFLStopPoint[](
            naptanIds.length
        );
        for (uint256 i = 0; i < naptanIds.length; i++) {
            result[i] = stops[naptanIds[i]];
        }
        return result;
    }

    function abiSignatureHack(DataTransportObject calldata dto) public pure {}

    function isJsonApiProofValid(
        IWeb2Json.Proof calldata _proof
    ) private view returns (bool) {
        // Inline the check for now until we have an official contract deployed
        return ContractRegistry.getFdcVerification().verifyJsonApi(_proof);
    }
}
