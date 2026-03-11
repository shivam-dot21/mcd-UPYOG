package org.egov.filestore.validator;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

import org.egov.tracer.model.CustomException;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class FileSignatureValidator {

    private static final Map<String, byte[]> FILE_SIGNATURES = new HashMap<>();

    static {

        FILE_SIGNATURES.put("pdf",
                new byte[]{0x25,0x50,0x44,0x46});

        FILE_SIGNATURES.put("png",
                new byte[]{(byte)0x89,0x50,0x4E,0x47});

        FILE_SIGNATURES.put("jpg",
                new byte[]{(byte)0xFF,(byte)0xD8});

        FILE_SIGNATURES.put("jpeg",
                new byte[]{(byte)0xFF,(byte)0xD8});

        FILE_SIGNATURES.put("gif",
                new byte[]{0x47,0x49,0x46});

        FILE_SIGNATURES.put("zip",
                new byte[]{0x50,0x4B,0x03,0x04});
    }

    public void validateSignature(
            MultipartFile file,
            String extension) {

        if(!FILE_SIGNATURES.containsKey(extension)){
            return;
        }

        byte[] expectedSignature =
                FILE_SIGNATURES.get(extension);

        try(InputStream is = file.getInputStream()){

            byte[] fileHeader =
                    new byte[expectedSignature.length];

            int read = is.read(fileHeader);

            if(read < expectedSignature.length){
                throw new CustomException(
                        "INVALID_FILE",
                        "File header too small"
                );
            }

            for(int i=0;i<expectedSignature.length;i++){

                if(fileHeader[i] != expectedSignature[i]){

                    throw new CustomException(
                            "INVALID_FILE",
                            "File signature mismatch"
                    );
                }
            }

        }catch(IOException e){

            throw new CustomException(
                    "INVALID_FILE",
                    "Unable to read file signature"
            );
        }
    }
}