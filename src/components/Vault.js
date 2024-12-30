import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { getLinkMetadata } from '../services/metadataService';
import '../styles/Vault.css';

const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { weekNo, year: date.getFullYear() };
};

const formatMonth = (date) => {
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
};

const Vault = () => {
  const { currentUser } = useAuth();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [toReadLinks, setToReadLinks] = useState([]);
  const [readLinks, setReadLinks] = useState([]);
  const [comments, setComments] = useState({});
  const [debouncedSaveTimeout, setDebouncedSaveTimeout] = useState(null);
  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingComment, setEditingComment] = useState('');
  const [editingDateId, setEditingDateId] = useState(null);
  const [editingDate, setEditingDate] = useState('');

  useEffect(() => {
    if (currentUser) {
      loadLinks();
    }
  }, [currentUser]);

  // Initialize comments state when links load
  useEffect(() => {
    const newComments = {};
    toReadLinks.forEach(link => {
      newComments[link.id] = link.comment || '';
    });
    setComments(newComments);
  }, [toReadLinks]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (debouncedSaveTimeout) {
        clearTimeout(debouncedSaveTimeout);
      }
    };
  }, [debouncedSaveTimeout]);

  const loadLinks = async () => {
    if (!currentUser) return;

    setLoadingLinks(true);
    setError('');

    try {
      const linksRef = collection(db, 'links');
      const q = query(linksRef, where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      
      const toRead = [];
      const read = [];
      
      querySnapshot.forEach((doc) => {
        const link = { id: doc.id, ...doc.data() };
        if (link.isRead) {
          read.push(link);
        } else {
          toRead.push(link);
        }
      });
      
      setToReadLinks(toRead);
      setReadLinks(read);
      setLoadingLinks(false);
    } catch (err) {
      console.error('Error loading links:', err);
      setError('Failed to load links. Please try again later.');
      setLoadingLinks(false);
    }
  };

  const handleUrlChange = async (e) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    setError('');
    setPreview(null);
    setIsManualEntry(false);
    setManualTitle('');
    setManualDescription('');

    if (newUrl && newUrl.match(/^https?:\/\/.+/)) {
      try {
        const metadata = await getLinkMetadata(newUrl);
        setPreview(metadata);
      } catch (err) {
        console.error('Error fetching metadata:', err);
        if (err.name === 'MetadataFetchError') {
          setIsManualEntry(true);
        }
      }
    }
  };

  const handleSaveLink = async (e) => {
    e.preventDefault();
    if (!url || !url.match(/^https?:\/\/.+/)) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    if (isManualEntry && !manualTitle.trim()) {
      setError('Please enter a title for the link');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const metadata = isManualEntry ? {
        title: manualTitle.trim(),
        description: manualDescription.trim(),
        url,
        image: ''
      } : (preview || await getLinkMetadata(url));

      const linkData = {
        url,
        comment: '',
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
        isRead: false,
        title: metadata.title,
        description: metadata.description || '',
        image: metadata.image || '',
      };

      await addDoc(collection(db, 'links'), linkData);
      
      setUrl('');
      setPreview(null);
      setManualTitle('');
      setManualDescription('');
      setIsManualEntry(false);
      await loadLinks();
    } catch (err) {
      console.error('Error saving link:', err);
      setError('Failed to save link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommentChange = (linkId, newComment) => {
    // Update local state immediately for smooth typing
    setComments(prev => ({ ...prev, [linkId]: newComment }));

    // Clear any existing timeout
    if (debouncedSaveTimeout) {
      clearTimeout(debouncedSaveTimeout);
    }

    // Set new timeout for saving to Firestore
    const timeoutId = setTimeout(async () => {
      try {
        const linkRef = doc(db, 'links', linkId);
        await updateDoc(linkRef, { comment: newComment });
      } catch (err) {
        console.error('Error saving comment:', err);
        setError('Failed to save comment.');
      }
    }, 2000); // Increased debounce time to 2 seconds

    setDebouncedSaveTimeout(timeoutId);
  };

  const handleToggleRead = async (linkId, currentReadState) => {
    try {
      const linkRef = doc(db, 'links', linkId);
      await updateDoc(linkRef, {
        isRead: !currentReadState
      });
      await loadLinks();
    } catch (err) {
      console.error('Error updating link:', err);
      setError('Failed to update link status.');
    }
  };

  const handleDeleteLink = async (linkId) => {
    try {
      await deleteDoc(doc(db, 'links', linkId));
      await loadLinks();
    } catch (err) {
      console.error('Error deleting link:', err);
      setError('Failed to delete link.');
    }
  };

  const handleEditTitle = async (linkId, newTitle) => {
    if (!newTitle.trim()) return;
    
    try {
      const linkRef = doc(db, 'links', linkId);
      await updateDoc(linkRef, { title: newTitle.trim() });
      await loadLinks();
      setEditingTitleId(null);
      setEditingTitle('');
    } catch (err) {
      console.error('Error updating title:', err);
      setError('Failed to update title.');
    }
  };

  const startEditingTitle = (linkId, currentTitle) => {
    setEditingTitleId(linkId);
    setEditingTitle(currentTitle);
  };

  const handleEditComment = async (linkId, newComment) => {
    try {
      const linkRef = doc(db, 'links', linkId);
      await updateDoc(linkRef, { comment: newComment.trim() });
      await loadLinks();
      setEditingCommentId(null);
      setEditingComment('');
    } catch (err) {
      console.error('Error updating comment:', err);
      setError('Failed to update comment.');
    }
  };

  const startEditingComment = (linkId, currentComment) => {
    setEditingCommentId(linkId);
    setEditingComment(currentComment || '');
  };

  const handleEditDate = async (linkId, newDate) => {
    try {
      const linkRef = doc(db, 'links', linkId);
      const newDateISO = new Date(newDate).toISOString();
      await updateDoc(linkRef, { createdAt: newDateISO });
      
      // Update state locally instead of reloading
      setReadLinks(prevLinks => {
        const updatedLinks = prevLinks.map(link => 
          link.id === linkId ? { ...link, createdAt: newDateISO } : link
        );
        return updatedLinks;
      });
      
      setEditingDateId(null);
      setEditingDate('');
    } catch (err) {
      console.error('Error updating date:', err);
      setError('Failed to update date.');
    }
  };

  const startEditingDate = (linkId, currentDate) => {
    setEditingDateId(linkId);
    // Format date to YYYY-MM-DD for input
    const date = new Date(currentDate);
    const formattedDate = date.toISOString().split('T')[0];
    setEditingDate(formattedDate);
  };

  const groupLinksByWeek = (links) => {
    const grouped = {};
    links.forEach(link => {
      const date = new Date(link.createdAt);
      const { weekNo, year } = getWeekNumber(date);
      const key = `${year}-${weekNo}`;
      if (!grouped[key]) {
        grouped[key] = {
          weekNo,
          year,
          links: []
        };
      }
      grouped[key].links.push(link);
    });
    
    // Convert to array and sort by date (newest first)
    return Object.values(grouped)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.weekNo - a.weekNo;
      });
  };

  const renderLinkCard = (link) => (
    <div key={link.id} className="link-card">
      <div className="link-header">
        <div className="link-title-group">
          {editingTitleId === link.id ? (
            <div className="edit-title-container">
              <div className="edit-title-wrapper">
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="edit-title-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleEditTitle(link.id, editingTitle);
                    } else if (e.key === 'Escape') {
                      setEditingTitleId(null);
                      setEditingTitle('');
                    }
                  }}
                  autoFocus
                />
                <div className="edit-title-actions">
                  <button
                    onClick={() => handleEditTitle(link.id, editingTitle)}
                    className="edit-title-save"
                    title="Save (Enter)"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => {
                      setEditingTitleId(null);
                      setEditingTitle('');
                    }}
                    className="edit-title-cancel"
                    title="Cancel (Esc)"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="link-url">
                {link.url}
              </a>
            </div>
          ) : (
            <>
              <div 
                className="title-display"
                onClick={() => startEditingTitle(link.id, link.title)}
                title="Click to edit title"
              >
                <h3 className="link-title">
                  {link.title}
                </h3>
              </div>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="link-url">
                {link.url}
              </a>
            </>
          )}
        </div>
        {editingDateId === link.id ? (
          <div className="edit-date-container">
            <input
              type="date"
              value={editingDate}
              onChange={(e) => setEditingDate(e.target.value)}
              className="edit-date-input"
              onBlur={() => {
                if (editingDate) {
                  handleEditDate(link.id, editingDate);
                } else {
                  setEditingDateId(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setEditingDateId(null);
                  setEditingDate('');
                }
              }}
              autoFocus
            />
          </div>
        ) : (
          <span 
            className="link-date"
            onClick={() => startEditingDate(link.id, link.createdAt)}
            title="Click to edit date"
          >
            {new Date(link.createdAt).toLocaleDateString()}
          </span>
        )}
      </div>
      <div className="link-content">
        {editingCommentId === link.id ? (
          <div className="edit-comment-container">
            <textarea
              value={editingComment}
              onChange={(e) => setEditingComment(e.target.value)}
              className="edit-comment-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) {
                  handleEditComment(link.id, editingComment);
                } else if (e.key === 'Escape') {
                  setEditingCommentId(null);
                  setEditingComment('');
                }
              }}
              placeholder="Add your thoughts..."
              autoFocus
            />
            <div className="edit-comment-actions">
              <button
                onClick={() => handleEditComment(link.id, editingComment)}
                className="edit-comment-save"
                title="Save (⌘ + Enter)"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingCommentId(null);
                  setEditingComment('');
                }}
                className="edit-comment-cancel"
                title="Cancel (Esc)"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div 
            className="comment-display"
            onClick={() => startEditingComment(link.id, link.comment)}
            title={link.comment ? "Click to edit comment" : "Click to add a comment"}
          >
            {link.comment ? (
              <p className="link-comment">{link.comment}</p>
            ) : (
              <p className="no-comment">Add your thoughts...</p>
            )}
          </div>
        )}
      </div>
      <div className="link-footer">
        <button
          className={`link-button ${link.isRead ? 'mark-as-unread' : 'mark-as-read'}`}
          onClick={() => handleToggleRead(link.id, link.isRead)}
        >
          {link.isRead ? 'Move to To Link' : 'Move to Linked'}
        </button>
      </div>
    </div>
  );

  if (!currentUser) {
    return <div className="vault-container">Please sign in to access your vault.</div>;
  }

  return (
    <div className="vault-container">
      <div className="add-links-section">
        <h2>Add New Link</h2>
        <form onSubmit={handleSaveLink} className="form-group">
          <div className="link-entry">
            <input
              type="url"
              value={url}
              onChange={handleUrlChange}
              placeholder="Enter URL"
              className="link-input"
              required
            />
            {isManualEntry && (
              <>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Enter title"
                  className="link-input"
                  required
                />
                <textarea
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="Enter description (optional)"
                  className="comment-input"
                />
              </>
            )}
          </div>
          {error && <p className="error-message">{error}</p>}
          <button
            type="submit"
            className="save-link-button"
            disabled={loading || !url || (isManualEntry && !manualTitle.trim())}
          >
            {loading ? 'Saving...' : 'Save Link'}
          </button>
        </form>
      </div>

      <div className="links-section">
        <h2>Link Queue</h2>
        <div className="link-list">
          {loadingLinks ? (
            <p>Loading links...</p>
          ) : toReadLinks.length > 0 ? (
            toReadLinks.map(renderLinkCard)
          ) : (
            <p>No links in queue</p>
          )}
        </div>
      </div>

      <div className="links-section">
        <h2>Linked</h2>
        <div className="link-list">
          {loadingLinks ? (
            <p>Loading links...</p>
          ) : readLinks.length > 0 ? (
            groupLinksByWeek(readLinks).map(group => (
              <div key={`${group.year}-${group.weekNo}`} className="week-group">
                <h3 className="week-header">Week {group.weekNo}, {group.year}</h3>
                {group.links.map(renderLinkCard)}
              </div>
            ))
          ) : (
            <p>No linked links</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Vault; 