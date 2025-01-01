import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { getLinkMetadata } from '../services/metadataService';
import '../styles/Vault.css';
import feedService from '../services/feedService';
import ConfirmModal from './ConfirmModal';
import { Link } from 'react-router-dom';

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
  const [selectedLinkId, setSelectedLinkId] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState('');
  const [selectedLinks, setSelectedLinks] = useState([]);
  const [isSelectingLinks, setIsSelectingLinks] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [confirmShare, setConfirmShare] = useState(false);
  const [currentMonthName, setCurrentMonthName] = useState('');
  const [currentYear, setCurrentYear] = useState('');

  useEffect(() => {
    if (currentUser) {
      loadLinks();
    }
  }, [currentUser]);

  useEffect(() => {
    const now = new Date();
    setCurrentMonthName(new Intl.DateTimeFormat('en-US', { month: 'long' }).format(now));
    setCurrentYear(now.getFullYear());
  }, []);

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
    let newUrl = e.target.value;
    
    // If URL doesn't start with a protocol, prepend https://
    if (newUrl && !newUrl.match(/^https?:\/\//)) {
      newUrl = `https://${newUrl}`;
    }
    
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
    let urlToSave = url;
    
    // If URL doesn't start with a protocol, prepend https://
    if (urlToSave && !urlToSave.match(/^https?:\/\//)) {
      urlToSave = `https://${urlToSave}`;
    }

    if (!urlToSave || !urlToSave.match(/^https?:\/\/.+/)) {
      setError('Please enter a valid URL');
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
        url: urlToSave,
        image: ''
      } : (preview || await getLinkMetadata(urlToSave));

      const linkData = {
        url: urlToSave,
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
    if (!window.confirm('Are you sure you want to delete this link? This action cannot be undone.')) {
      return;
    }

    try {
      const linkRef = doc(db, 'links', linkId);
      await deleteDoc(linkRef);
      
      // Remove the link from state
      setToReadLinks(toReadLinks.filter(link => link.id !== linkId));
      setReadLinks(readLinks.filter(link => link.id !== linkId));
      
      // Remove from selected links if it was selected
      if (selectedLinks.includes(linkId)) {
        setSelectedLinks(selectedLinks.filter(id => id !== linkId));
      }
    } catch (error) {
      console.error('Error deleting link:', error);
      alert('Failed to delete link. Please try again.');
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

  const handleShareToFeed = async (linkId) => {
    setShareLoading(true);
    setShareError('');
    try {
      const link = readLinks.find(l => l.id === linkId) || toReadLinks.find(l => l.id === linkId);
      if (!link) {
        throw new Error('Link not found');
      }

      await feedService.createPost({
        url: link.url,
        title: link.title,
        description: link.description,
        comment: link.comment,
        userId: currentUser.uid,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || currentUser.email,
        authorPhotoURL: currentUser.photoURL,
        createdAt: new Date()
      });

      setShareError('');
      // Refresh links to update UI
      await loadLinks();
    } catch (error) {
      console.error('Error sharing to feed:', error);
      setShareError('Failed to share link to feed. Please try again.');
    } finally {
      setShareLoading(false);
    }
  };

  const handleShareMonthlyReLink = async () => {
    setShareLoading(true);
    setShareError('');
    try {
      if (selectedLinks.length !== 5) {
        throw new Error('Please select exactly 5 links to share');
      }

      const links = selectedLinks.map(id => 
        readLinks.find(l => l.id === id) || toReadLinks.find(l => l.id === id)
      ).filter(Boolean);

      await feedService.createPost({
        monthlyLinks: links.map(link => ({
          url: link.url,
          title: link.title,
          description: link.description,
          comment: link.comment
        })),
        userId: currentUser.uid,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || currentUser.email,
        authorPhotoURL: currentUser.photoURL,
        createdAt: new Date(),
        type: 'monthly'
      });

      setShareError('');
      setIsShareModalOpen(false);
      setSelectedLinks([]);
      alert('Successfully shared your monthly ReLink!');
      // Refresh links to update UI
      await loadLinks();
    } catch (error) {
      console.error('Error sharing monthly ReLink:', error);
      setShareError(error.message || 'Failed to share monthly ReLink. Please try again.');
    } finally {
      setShareLoading(false);
      setConfirmShare(false);
    }
  };

  const toggleLinkSelection = (linkId) => {
    setSelectedLinks(prev => {
      if (prev.includes(linkId)) {
        return prev.filter(id => id !== linkId);
      }
      if (prev.length >= 5) {
        return prev;
      }
      return [...prev, linkId];
    });
  };

  const renderLinkCard = (link) => (
    <div key={link.id} className="bg-white rounded-lg shadow p-4 sm:p-6 relative">
      {isSelectingLinks && (
        <div className="absolute top-4 right-4">
          <input
            type="checkbox"
            checked={selectedLinks.includes(link.id)}
            onChange={() => toggleLinkSelection(link.id)}
            disabled={!selectedLinks.includes(link.id) && selectedLinks.length >= 5}
            className="w-5 h-5"
          />
        </div>
      )}
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
        <div className="link-actions">
          <button
            onClick={() => handleDeleteLink(link.id)}
            className="text-gray-400 hover:text-red-500 transition-colors p-2"
            title="Delete link"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      <div className="link-content">
        {editingCommentId === link.id ? (
          <div className="edit-comment-container">
            <textarea
              value={editingComment}
              onChange={(e) => setEditingComment(e.target.value)}
              className="edit-comment-input"
              placeholder="Add your thoughts..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEditComment(link.id, editingComment);
                } else if (e.key === 'Escape') {
                  setEditingCommentId(null);
                  setEditingComment('');
                }
              }}
              autoFocus
            />
            <div className="edit-comment-actions">
              <button
                onClick={() => handleEditComment(link.id, editingComment)}
                className="edit-comment-save"
                title="Save (Enter)"
              >
                ✓
              </button>
              <button
                onClick={() => {
                  setEditingCommentId(null);
                  setEditingComment('');
                }}
                className="edit-comment-cancel"
                title="Cancel (Esc)"
              >
                ✕
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
      
      {/* Add relinked attribution if present */}
      {link.relinkedFrom && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>ReLinked from</span>
            <Link
              to={`/profile/${link.relinkedFrom.userId}`}
              className="font-medium text-primary hover:underline"
            >
              @{link.relinkedFrom.userName}
            </Link>
            <span className="text-xs">
              {new Date(link.relinkedFrom.timestamp?.toDate()).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  const renderShareModal = () => {
    if (!isShareModalOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Edit {currentMonthName} ReLink</h2>
            <button
              onClick={() => {
                setIsShareModalOpen(false);
                setSelectedLinks([]);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <p className="text-gray-600 mb-6">
            Select your top 5 favorite links from your Linked section to share with your friends.
            This will be your ReLink for {currentMonthName} {currentYear}.
          </p>

          <div className="space-y-4">
            {readLinks.map(link => (
              <div 
                key={link.id} 
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedLinks.includes(link.id) 
                    ? 'border-primary bg-primary bg-opacity-5' 
                    : 'border-gray-200 hover:border-primary'
                }`}
                onClick={() => toggleLinkSelection(link.id)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedLinks.includes(link.id)}
                    onChange={() => toggleLinkSelection(link.id)}
                    className="mt-1 w-5 h-5"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{link.title}</h3>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                      {link.url}
                    </a>
                    {link.comment && (
                      <p className="mt-2 text-gray-600 text-sm">{link.comment}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <span className="text-gray-600">
              {selectedLinks.length}/5 links selected
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsShareModalOpen(false);
                  setSelectedLinks([]);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => setConfirmShare(true)}
                disabled={selectedLinks.length !== 5 || shareLoading}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {shareLoading ? 'Sharing...' : `Share ${currentMonthName} ReLink`}
              </button>
            </div>
          </div>

          {shareError && (
            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg">
              {shareError}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!currentUser) {
    return <div className="vault-container">Please sign in to access your vault.</div>;
  }

  return (
    <div className="vault-container">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <h1 className="text-xl sm:text-2xl font-bold">Your Vault</h1>
        <button
          onClick={() => setIsShareModalOpen(true)}
          className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm sm:text-base"
        >
          Edit {currentMonthName} ReLink
        </button>
      </div>

      {shareError && (
        <div className="mb-4 p-3 sm:p-4 bg-red-50 text-red-600 rounded-lg text-sm sm:text-base">
          {shareError}
        </div>
      )}

      <div className="add-links-section">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">Add New Link</h2>
        <form onSubmit={handleSaveLink} className="form-group">
          <div className="link-entry">
            <input
              type="url"
              value={url}
              onChange={handleUrlChange}
              placeholder="Enter URL"
              className="link-input text-sm sm:text-base"
              required
            />
            {isManualEntry && (
              <>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Enter title"
                  className="link-input mt-3 text-sm sm:text-base"
                  required
                />
                <textarea
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="Enter description (optional)"
                  className="comment-input mt-3 text-sm sm:text-base"
                />
              </>
            )}
          </div>
          {error && <p className="error-message text-sm sm:text-base">{error}</p>}
          <button
            type="submit"
            className="save-link-button w-full sm:w-auto text-sm sm:text-base"
            disabled={loading || !url || (isManualEntry && !manualTitle.trim())}
          >
            {loading ? 'Saving...' : 'Save Link'}
          </button>
        </form>
      </div>

      <div className="links-section">
        <h2 className="text-lg sm:text-xl font-semibold">Link Queue</h2>
        <div className="link-list">
          {loadingLinks ? (
            <p className="text-sm sm:text-base">Loading links...</p>
          ) : toReadLinks.length > 0 ? (
            toReadLinks.map(renderLinkCard)
          ) : (
            <p className="text-sm sm:text-base">No links in queue</p>
          )}
        </div>
      </div>

      <div className="links-section">
        <h2 className="text-lg sm:text-xl font-semibold">Linked</h2>
        <div className="link-list">
          {loadingLinks ? (
            <p className="text-sm sm:text-base">Loading links...</p>
          ) : readLinks.length > 0 ? (
            groupLinksByWeek(readLinks).map(group => (
              <div key={`${group.year}-${group.weekNo}`} className="week-group">
                <h3 className="week-header text-base sm:text-lg font-medium mb-3 sm:mb-4">
                  Week {group.weekNo}, {group.year}
                </h3>
                {group.links.map(renderLinkCard)}
              </div>
            ))
          ) : (
            <p className="text-sm sm:text-base">No linked links</p>
          )}
        </div>
      </div>

      {renderShareModal()}
      
      <ConfirmModal
        isOpen={confirmShare}
        onClose={() => setConfirmShare(false)}
        onConfirm={handleShareMonthlyReLink}
        title={`Share ${currentMonthName} ReLink`}
        message={
          <div className="space-y-3 sm:space-y-4">
            <p className="text-sm sm:text-base">
              You're about to share your {currentMonthName} {currentYear} ReLink with your friends.
            </p>
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
              <p className="font-medium mb-2 text-sm sm:text-base">Selected Links:</p>
              <ol className="list-decimal list-inside space-y-1.5 sm:space-y-2">
                {selectedLinks.map(id => {
                  const link = readLinks.find(l => l.id === id);
                  return link ? (
                    <li key={id} className="text-gray-700 text-sm sm:text-base">
                      {link.title}
                    </li>
                  ) : null;
                })}
              </ol>
            </div>
          </div>
        }
        confirmText={`Share ${currentMonthName} ReLink`}
        type="primary"
      />
    </div>
  );
};

export default Vault; 