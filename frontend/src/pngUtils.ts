// frontend/src/pngUtils.ts

const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf: Uint8Array): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Записываем JSON в PNG
export async function embedJsonToPng(pngBlob: Blob, jsonData: any): Promise<Blob> {
  const arrayBuffer = await pngBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Чанк IEND всегда в самом конце (12 байт)
  const iendIndex = uint8Array.length - 12;
  
  const keyword = stringToBytes("card_data\0");
  const jsonString = stringToBytes(JSON.stringify(jsonData));
  
  const chunkData = new Uint8Array(keyword.length + jsonString.length);
  chunkData.set(keyword, 0);
  chunkData.set(jsonString, keyword.length);

  const lengthBytes = new Uint8Array(4);
  new DataView(lengthBytes.buffer).setUint32(0, chunkData.length);

  const typeBytes = stringToBytes("tEXt");

  const crcInput = new Uint8Array(typeBytes.length + chunkData.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(chunkData, typeBytes.length);
  
  const crcBytes = new Uint8Array(4);
  new DataView(crcBytes.buffer).setUint32(0, crc32(crcInput));

  const newChunk = new Uint8Array(4 + 4 + chunkData.length + 4);
  let offset = 0;
  newChunk.set(lengthBytes, offset); offset += 4;
  newChunk.set(typeBytes, offset); offset += 4;
  newChunk.set(chunkData, offset); offset += chunkData.length;
  newChunk.set(crcBytes, offset);

  const finalUint8Array = new Uint8Array(uint8Array.length + newChunk.length);
  finalUint8Array.set(uint8Array.slice(0, iendIndex), 0);
  finalUint8Array.set(newChunk, iendIndex);
  finalUint8Array.set(uint8Array.slice(iendIndex), iendIndex + newChunk.length);

  return new Blob([finalUint8Array], { type: 'image/png' });
}

// Читаем JSON из PNG
export async function extractJsonFromPng(file: File): Promise<any | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const dataView = new DataView(arrayBuffer);
    
    let offset = 8;
    while (offset < uint8Array.length) {
      const length = dataView.getUint32(offset);
      const type = new TextDecoder().decode(uint8Array.slice(offset + 4, offset + 8));
      
      if (type === 'tEXt') {
        const textData = new TextDecoder().decode(uint8Array.slice(offset + 8, offset + 8 + length));
        if (textData.startsWith('card_data\0')) {
          const jsonStr = textData.substring(10);
          return JSON.parse(jsonStr);
        }
      }
      offset += 12 + length;
    }
    return null;
  } catch (e) {
    console.error("Ошибка чтения PNG", e);
    return null;
  }
}