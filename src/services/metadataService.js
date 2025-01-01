const LINKPREVIEW_API_KEY = process.env.REACT_APP_LINKPREVIEW_API_KEY;

export class MetadataFetchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MetadataFetchError';
  }
}

export const getLinkMetadata = async (url) => {
  try {
    const response = await fetch(`https://api.linkpreview.net/?key=${LINKPREVIEW_API_KEY}&q=${encodeURIComponent(url)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('LinkPreview API response:', data);
    
    return {
      title: data.title || url,
      description: data.description || '',
      image: data.image || '',
      url: url
    };
  } catch (error) {
    console.error('Error fetching URL metadata:', error);
    throw new MetadataFetchError('Failed to fetch link metadata. Please enter the title manually.');
  }
}; 