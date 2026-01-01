import api from 'api/axios';

interface Config {
  method: string, 
  url: string, 
  headers: { [key: string]: any; } | undefined, 
  data?: any | null
}

const apiSetting = async ({ method, url, headers = undefined, data = null }: { method: string, url: string, headers:{ [key: string]: any; } | undefined, data?: any | null }) => {
  try {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      throw new Error('Invalid URL');
    }

    const config: Config = {
      method: method,
      url: url,
      headers: undefined,
      data: null
    };

    if (headers != null) {
      config.headers = headers;
    }

    if (data != null) {
      config.data = data;
    }
    console.log(config);
    const response = await api(config);
    return response;
  } catch (error) {
    throw error;
  }
};

export default apiSetting;
