import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, query, where, getDocs, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { format, setYear } from 'date-fns';
import { getAuth } from 'firebase/auth';

// Helper function to safely get hostname from URL
const getHostname = (urlString) => {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch (error) {
    return urlString;
  }
};

// Helper function to safely create preview object
const createPreview = (data) => {
  return {
    title: data?.preview?.title || data?.preview?.site || 'No Title',
    description: data?.preview?.description || '',
    image: data?.preview?.image || '',
    url: data?.url || '',
    author: data?.preview?.author || '',
    site: data?.preview?.site || '',
    date: data?.preview?.date || ''
  };
};

const fetchUrlMetadata = async (url) => {
  try {
    const auth = getAuth();
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch('https://us-central1-curate-f809d.cloudfunctions.net/fetchUrlMetadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ url })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data || !data.data) {
      throw new Error('Invalid response format');
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching URL metadata:', error);
    // Return basic preview data instead of throwing
    return {
      data: {
        title: getHostname(url),
        description: '',
        image: '',
        url: url
      }
    };
  }
};

export default function Vault() {
  const initialLinkEntries = [{ url: '', comment: '', title: '', preview: null }];
  const [linkEntries, setLinkEntries] = useState(initialLinkEntries);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedLinks, setSavedLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();
  const [editingLink, setEditingLink] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);

  // Set dates for 2024
  const now = new Date();
  const year2024 = setYear(now, 2024);
  const currentMonthKey = format(year2024, 'MMMM yyyy');

  useEffect(() => {
    loadSavedLinks();
  }, [currentUser]);

  const loadSavedLinks = async () => {
    try {
      // Create start and end dates for December 2024
      const startOfDecember = new Date(2024, 11, 1); // Month is 0-based, so 11 is December
      const endOfDecember = new Date(2024, 11, 31, 23, 59, 59, 999);

      const q = query(
        collection(db, "relinks"),
        where("userId", "==", currentUser.uid),
        where("createdAt", ">=", Timestamp.fromDate(startOfDecember)),
        where("createdAt", "<=", Timestamp.fromDate(endOfDecember)),
        orderBy("createdAt", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const links = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          preview: createPreview(data),
          createdAt: data.createdAt.toDate()
        };
      });
      setSavedLinks(links);
      setLoading(false);
    } catch (error) {
      console.error('Error loading saved links:', error);
      setError('Failed to load saved links');
      setLoading(false);
    }
  };

  const saveLink = async (entry, index) => {
    if (!entry.url || !entry.url.match(/^https?:\/\/.+/)) return;
    
    try {
      // Validate URL before saving
      try {
        new URL(entry.url);
      } catch (urlError) {
        setError('Invalid URL format');
        return;
      }

      const docRef = await addDoc(collection(db, "relinks"), {
        userId: currentUser.uid,
        url: entry.url,
        comment: entry.comment || '',
        preview: entry.preview || {
          title: new URL(entry.url).hostname,
          description: '',
          image: '',
          url: entry.url
        },
        createdAt: Timestamp.now()
      });
      
      console.log('Saved to Firestore with ID:', docRef.id);
      
      if (docRef.id) {
        await loadSavedLinks(); // Load saved links first
        const newEntry = { url: '', comment: '', title: '', preview: null };
        const updatedEntries = [...linkEntries];
        updatedEntries[index] = newEntry;
        setLinkEntries(updatedEntries);
        setSuccess('Link saved successfully!');
      }
    } catch (error) {
      console.error('Save error:', error);
      setError('Failed to save link. Please try again.');
    }
  };

  const handleLinkChange = async (index, value) => {
    try {
      const updatedEntries = [...linkEntries];
      updatedEntries[index] = {
        ...updatedEntries[index],
        url: value
      };
      setLinkEntries(updatedEntries);

      // Check if it's a valid URL
      if (value && value.match(/^https?:\/\/.+/)) {
        try {
          console.log('Fetching metadata for:', value);
          const result = await fetchUrlMetadata(value);
          console.log('API response:', result);
          
          if (result?.data) {
            const preview = {
              title: result.data.title || getHostname(value),
              description: result.data.description || '',
              image: result.data.image || '',
              url: value
            };
            
            console.log('Preview data:', preview);
            
            // Update the entry with preview but don't save yet
            updatedEntries[index] = {
              ...updatedEntries[index],
              preview: preview
            };
            setLinkEntries([...updatedEntries]);
          }
        } catch (previewError) {
          console.error('Preview API error:', previewError);
          // Create basic preview if API fails
          const basicPreview = {
            title: getHostname(value),
            description: '',
            image: '',
            url: value
          };
          
          // Update the entry with basic preview but don't save yet
          updatedEntries[index] = {
            ...updatedEntries[index],
            preview: basicPreview
          };
          setLinkEntries([...updatedEntries]);
        }
      } else if (value && !value.match(/^https?:\/\/.+/)) {
        setError('Please enter a valid URL starting with http:// or https://');
      } else if (!value) {
        updatedEntries[index].preview = null;
        setLinkEntries([...updatedEntries]);
        setError('');
      }
    } catch (error) {
      console.error('General error in handleLinkChange:', error);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const handleCommentChange = (index, value) => {
    const updatedEntries = [...linkEntries];
    updatedEntries[index] = {
      ...updatedEntries[index],
      comment: value
    };
    setLinkEntries(updatedEntries);
  };

  // Add cleanup effect to save any unsaved changes when leaving the page
  useEffect(() => {
    return () => {
      // Save any unsaved entries when component unmounts
      linkEntries.forEach((entry, index) => {
        if (entry.url && entry.preview) {
          saveLink(entry, index);
        }
      });
    };
  }, []);

  const handleKeyDown = async (index, event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const entry = linkEntries[index];
      if (entry.url && entry.preview) {
        try {
          const docRef = await addDoc(collection(db, "relinks"), {
            userId: currentUser.uid,
            url: entry.url,
            comment: entry.comment || '',
            preview: entry.preview,
            createdAt: Timestamp.now()
          });
          
          if (docRef.id) {
            const newEntry = { url: '', comment: '', title: '', preview: null };
            const updatedEntries = [...linkEntries];
            updatedEntries[index] = newEntry;
            setLinkEntries(updatedEntries);
            setSuccess('Link saved successfully!');
            await loadSavedLinks();
          }
        } catch (error) {
          console.error('Save error:', error);
          setError('Failed to save link. Please try again.');
        }
      }
    }
  };

  const addNewLinkEntry = () => {
    const newEntry = {
      id: Date.now(), // Add unique ID for each entry
      url: '',
      comment: '',
      title: '',
      preview: null
    };
    setLinkEntries([newEntry, ...linkEntries]);
  };

  const removeLinkEntry = (index) => {
    // Protect the last link (Link 1)
    if (index !== linkEntries.length - 1) {
      const updatedEntries = linkEntries.filter((_, i) => i !== index);
      setLinkEntries(updatedEntries);
    }
  };

  const handleDelete = async (linkId) => {
    if (!linkId) {
      console.error('No link ID provided for deletion');
      setError('Cannot delete link: Invalid ID');
      return;
    }

    try {
      console.log('Attempting to delete link with ID:', linkId);
      // Create a reference to the specific document
      const linkRef = doc(db, "relinks", linkId);
      // Delete the document
      await deleteDoc(linkRef);
      console.log('Link deleted successfully');
      // Update local state
      setSavedLinks(prevLinks => prevLinks.filter(link => link.id !== linkId));
      setSuccess('Link deleted successfully');
      setOpenMenu(null);
      // Reload the links to ensure sync
      await loadSavedLinks();
    } catch (error) {
      console.error('Error deleting link:', error);
      setError('Failed to delete link: ' + error.message);
    }
  };

  const handleEdit = async (linkId, updatedData) => {
    try {
      console.log('Updating link:', linkId, 'with data:', updatedData);
      const linkRef = doc(db, "relinks", linkId);
      await updateDoc(linkRef, {
        url: updatedData.url,
        comment: updatedData.comment,
        preview: updatedData.preview,
        updatedAt: Timestamp.now()
      });
      console.log('Link updated successfully');
      setSuccess('Link updated successfully');
      await loadSavedLinks();
      setEditingLink(null);
    } catch (error) {
      console.error('Error updating link:', error);
      setError('Failed to update link: ' + error.message);
    }
  };

  return (
    <div className="vault-container">
      <h2>Your Link Vault</h2>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
      
      <div className="month-section">
        <h4 className="month-header">{currentMonthKey}</h4>
        
        <div className="add-links-section">
          <div className="vault-actions">
            <button 
              type="button" 
              onClick={addNewLinkEntry}
              className="add-link-button"
            >
              + Add Another Link
            </button>
          </div>

          {[...linkEntries].map((entry, index) => (
            <div key={entry.id || index} className="link-entry">
              {index !== linkEntries.length - 1 && (
                <button
                  type="button"
                  className="remove-link-button"
                  onClick={() => removeLinkEntry(index)}
                >
                  ×
                </button>
              )}
              <div className="form-group">
                <label>Link {linkEntries.length - index}</label>
                <input
                  type="url"
                  value={entry.url}
                  onChange={(e) => handleLinkChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pastedText = e.clipboardData.getData('text');
                    handleLinkChange(index, pastedText);
                  }}
                  placeholder="https://"
                />
                {entry.preview && (
                  <div className="link-preview">
                    <a href={entry.url} target="_blank" rel="noopener noreferrer" className="preview-title">
                      {entry.preview.title}
                    </a>
                    {entry.preview.image && (
                      <div className="preview-image">
                        <img src={entry.preview.image} alt={entry.preview.title || 'Link preview'} />
                      </div>
                    )}
                    {entry.preview.description && (
                      <p className="preview-description">{entry.preview.description}</p>
                    )}
                    <div className="preview-meta">
                      {entry.preview.site && (
                        <span className="preview-site">{entry.preview.site}</span>
                      )}
                      {entry.preview.author && (
                        <span className="preview-author">By {entry.preview.author}</span>
                      )}
                      {entry.preview.date && (
                        <span className="preview-date">{entry.preview.date}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="form-group">
                <textarea
                  value={entry.comment}
                  onChange={(e) => handleCommentChange(index, e.target.value)}
                  placeholder="Share your thoughts about this link..."
                />
              </div>
              {entry.preview && (
                <button
                  type="button"
                  className="save-link-button"
                  onClick={() => saveLink(entry, index)}
                >
                  Save Link
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="month-section">
        <h4 className="month-header">December 2024</h4>
        <div className="month-links">
          {loading ? (
            <div className="loading">Loading saved links...</div>
          ) : savedLinks.length > 0 ? (
            savedLinks.map((link) => (
              <div key={link.id} className={`saved-link-entry ${editingLink === link.id ? 'edit-mode' : ''}`}>
                <div className="link-settings">
                  <button
                    className="link-settings-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenu(openMenu === link.id ? null : link.id);
                    }}
                  >
                    ⋮
                  </button>
                  {openMenu === link.id && (
                    <div className="link-settings-menu">
                      <button onClick={(e) => {
                        e.stopPropagation();
                        setEditingLink(link.id);
                        setOpenMenu(null);
                      }}>
                        ✏️ Edit
                      </button>
                      <button 
                        className="delete"
                        onClick={async (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          console.log('Delete clicked for link:', link.id);
                          if (window.confirm('Are you sure you want to delete this link?')) {
                            await handleDelete(link.id);
                          }
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </div>
                <div className="link-preview">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="preview-title">
                    {link.preview.title}
                  </a>
                  {link.preview.image && (
                    <div className="preview-image">
                      <img src={link.preview.image} alt={link.preview.title || 'Link preview'} />
                    </div>
                  )}
                  {link.preview.description && (
                    <p className="preview-description">{link.preview.description}</p>
                  )}
                  <div className="preview-meta">
                    {link.preview.site && (
                      <span className="preview-site">{link.preview.site}</span>
                    )}
                    {link.preview.author && (
                      <span className="preview-author">By {link.preview.author}</span>
                    )}
                    <span className="preview-date">
                      {format(link.createdAt, 'MMM d, yyyy')}
                    </span>
                  </div>
                  {link.comment && (
                    <p className="saved-comment">{link.comment}</p>
                  )}
                </div>
                {editingLink === link.id && (
                  <div className="edit-form">
                    <input
                      type="url"
                      defaultValue={link.url}
                      placeholder="URL"
                      id={`edit-url-${link.id}`}
                    />
                    <textarea
                      defaultValue={link.comment}
                      placeholder="Your thoughts about this link..."
                      id={`edit-comment-${link.id}`}
                    />
                    <div className="edit-form-actions">
                      <button 
                        className="cancel" 
                        onClick={() => setEditingLink(null)}
                      >
                        Cancel
                      </button>
                      <button 
                        className="save" 
                        onClick={async () => {
                          try {
                            const newUrl = document.getElementById(`edit-url-${link.id}`).value;
                            const newComment = document.getElementById(`edit-comment-${link.id}`).value;
                            
                            if (!newUrl || !newUrl.match(/^https?:\/\/.+/)) {
                              setError('Please enter a valid URL starting with http:// or https://');
                              return;
                            }

                            console.log('Fetching metadata for edited URL:', newUrl);
                            const result = await fetchUrlMetadata(newUrl);
                            console.log('Metadata result:', result);

                            const preview = {
                              title: result.data.title || getHostname(newUrl),
                              description: result.data.description || '',
                              image: result.data.image || '',
                              url: newUrl
                            };
                            
                            await handleEdit(link.id, {
                              url: newUrl,
                              comment: newComment,
                              preview: preview
                            });
                          } catch (error) {
                            console.error('Edit save error:', error);
                            setError('Failed to update link: ' + error.message);
                          }
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div>No links saved yet</div>
          )}
        </div>
      </div>
    </div>
  );
} 