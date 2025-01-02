import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { getLinkMetadata } from '../services/metadataService';
import '../styles/Vault.css';
import feedService, { getCurrentMonthPost } from '../services/feedService';
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
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAlert, setShowAlert] = useState({});
  const [hasSharedThisMonth, setHasSharedThisMonth] = useState(false);
  const [currentMonthPost, setCurrentMonthPost] = useState(null);
  const [canEditMonthlyPost, setCanEditMonthlyPost] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadLinks();
      checkMonthlyShare();
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

  useEffect(() => {
    // Check for URL parameter when component mounts
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url');
    
    if (urlParam) {
      setUrl(urlParam);
      // Trigger metadata fetch for the URL
      handleUrlChange({ target: { value: urlParam } });
      // Clean up the URL parameter
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

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
      await updateDoc(linkRef, { createdAt: newDate });
      await loadLinks();
      setEditingDateId(null);
      setEditingDate('');
    } catch (err) {
      console.error('Error updating date:', err);
      setError('Failed to update date.');
    }
  };

  const startEditingDate = (linkId, currentDate) => {
    setEditingDateId(linkId);
    setEditingDate(currentDate);
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

      // Refresh monthly share status
      await checkMonthlyShare();

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
    <div key={link.id} className="bg-white rounded-lg shadow p-3 sm:p-4 relative">
      <div className="absolute top-3 right-3 flex flex-col items-end">
        {editingDateId === link.id ? (
          <input
            type="date"
            value={editingDate}
            onChange={(e) => setEditingDate(e.target.value)}
            className="edit-date-input"
            onBlur={() => handleEditDate(link.id, editingDate)}
            autoFocus
          />
        ) : (
          <div 
            className="date-display"
            onClick={() => startEditingDate(link.id, link.createdAt)}
            title="Click to edit date"
          >
            <p className="link-date">{new Date(link.createdAt).toLocaleDateString()}</p>
          </div>
        )}
        <div className="settings-menu">
          <button
            onClick={() => handleDeleteLink(link.id)}
            className="text-gray-400 hover:text-red-500 transition-colors p-1"
            title="Delete link"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 3a1 1 0 011-1h6a1 1 0 011 1v1h4a1 1 0 110 2h-1v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6H2a1 1 0 110-2h4V3zm3 3a1 1 0 00-1 1v7a1 1 0 102 0V7a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v7a1 1 0 102 0V7a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      <div className="link-header mb-8">
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
      </div>
      <div className="link-content mb-8">
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
      <div className="absolute bottom-3 right-3">
        <button
          className={`text-sm px-5 py-2.5 rounded-full font-medium shadow-sm transition-all duration-150 ease-in-out ${
            link.isRead 
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' 
              : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
          }`}
          onClick={() => handleToggleRead(link.id, link.isRead)}
        >
          {link.isRead ? 'Move to Queue' : 'Move to Linked'}
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

  const handleEditReLink = async () => {
    try {
      setIsEditing(true);
      
      if (!currentMonthPost?.canEdit) {
        setShowAlert({
          type: 'error',
          message: 'This ReLink can no longer be edited as the month has passed.'
        });
        return;
      }

      // Pre-select the current month's links
      const currentLinkIds = currentMonthPost.monthlyLinks.map(link => {
        const matchingLink = [...toReadLinks, ...readLinks].find(l => l.url === link.url);
        return matchingLink ? matchingLink.id : null;
      }).filter(Boolean);
      
      setSelectedLinks(currentLinkIds);
      
      setShowConfirmModal(true);
      setConfirmModalConfig({
        title: `Edit ${currentMonthPost.monthName} ${currentMonthPost.year} ReLink`,
        message: 'Select up to 5 links for this month\'s ReLink. You can remove existing links and add new ones.',
        confirmText: 'Update ReLink',
        onConfirm: async () => {
          try {
            setIsSubmitting(true);
            const allLinks = [...toReadLinks, ...readLinks];
            const linksToShare = selectedLinks.map(linkId => {
              const link = allLinks.find(l => l.id === linkId);
              return {
                url: link.url,
                title: link.title,
                description: link.description || '',
                comment: link.comment || '',
                image: link.image || ''
              };
            });
            
            await feedService.updateMonthlyPost(currentUser.uid, linksToShare);
            
            setShowAlert({
              type: 'success',
              message: 'Your ReLink has been updated!'
            });
            
            // Refresh the monthly post status
            await checkMonthlyShare();
            
            setSelectedLinks([]);
            setIsEditing(false);
            setShowConfirmModal(false);
          } catch (error) {
            console.error('Error updating ReLink:', error);
            setShowAlert({
              type: 'error',
              message: error.message || 'Failed to update ReLink. Please try again.'
            });
          } finally {
            setIsSubmitting(false);
          }
        },
        onCancel: () => {
          setSelectedLinks([]);
          setIsEditing(false);
          setShowConfirmModal(false);
        }
      });
    } catch (error) {
      console.error('Error preparing edit:', error);
      setShowAlert({
        type: 'error',
        message: 'Failed to prepare edit. Please try again.'
      });
    }
  };

  const checkMonthlyShare = async () => {
    try {
      const post = await getCurrentMonthPost(currentUser.uid);
      const hasShared = await feedService.hasPostedThisMonth(currentUser.uid);
      setCurrentMonthPost(post);
      setHasSharedThisMonth(hasShared);
      setCanEditMonthlyPost(post?.canEdit || false);
    } catch (err) {
      console.error('Error checking monthly share:', err);
      setShowAlert({
        type: 'error',
        message: 'Failed to check monthly post status.'
      });
    }
  };

  const handleShareLinks = async () => {
    if (!selectedLinks || selectedLinks.length !== 5) {
      setShareError('Please select exactly 5 links to share.');
      return;
    }

    setShareLoading(true);
    setShareError('');

    try {
      const linksToShare = selectedLinks.map(linkId => {
        const link = [...toReadLinks, ...readLinks].find(l => l.id === linkId);
        return {
          url: link.url,
          title: link.title,
          description: link.description,
          image: link.image,
          comment: link.comment
        };
      });

      await feedService.createPost({
        userId: currentUser.uid,
        type: 'monthly',
        monthlyLinks: linksToShare
      });

      // Refresh monthly share status
      await checkMonthlyShare();

      setSelectedLinks([]);
      setIsSelectingLinks(false);
      setShareError('');
    } catch (err) {
      console.error('Error sharing links:', err);
      setShareError(err.message || 'Failed to share links.');
    } finally {
      setShareLoading(false);
    }
  };

  if (!currentUser) {
    return <div className="vault-container">Please sign in to access your vault.</div>;
  }

  return (
    <div className="vault-container">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <h1 className="text-xl sm:text-2xl font-bold">Your Vault</h1>
        <div className="flex gap-2">
          {hasSharedThisMonth ? (
            canEditMonthlyPost ? (
              <button
                onClick={handleEditReLink}
                disabled={isSubmitting || (toReadLinks.length === 0 && readLinks.length === 0)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Updating...' : 'Edit ReLink'}
              </button>
            ) : (
              <div className="text-sm text-gray-500">
                {currentMonthPost ? `Posted ${currentMonthPost.monthName} ReLink` : 'ReLink posted'}
              </div>
            )
          ) : (
            <button
              onClick={handleShareLinks}
              disabled={selectedLinks.length !== 5 || isSubmitting}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Sharing...' : 'Share ReLink'}
            </button>
          )}
        </div>
      </div>

      {shareError && (
        <div className="mb-4 p-3 sm:p-4 bg-red-50 text-red-600 rounded-lg text-sm sm:text-base">
          {shareError}
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setSelectedLinks([]);
          setIsEditing(false);
        }}
        onConfirm={confirmModalConfig.onConfirm}
        title={confirmModalConfig.title}
        message={
          <div className="space-y-4">
            <p>{confirmModalConfig.message}</p>
            <div className="bg-white p-4 rounded-lg max-h-[60vh] overflow-y-auto">
              <p className="font-medium mb-4">Select 5 links from your Linked section ({selectedLinks.length}/5 selected):</p>
              <div className="space-y-3">
                {readLinks.map(link => {
                  const isSelected = selectedLinks.includes(link.id);
                  const canSelect = isSelected || selectedLinks.length < 5;
                  
                  return (
                    <div 
                      key={link.id} 
                      className={`p-3 border rounded-lg transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) {
                              setSelectedLinks(selectedLinks.filter(id => id !== link.id));
                            } else if (canSelect) {
                              setSelectedLinks([...selectedLinks, link.id]);
                            }
                          }}
                          disabled={!isSelected && !canSelect}
                          className="mt-1 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">{link.title}</h3>
                          <a 
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-sm text-blue-600 hover:underline truncate block"
                          >
                            {link.url}
                          </a>
                          {link.comment && (
                            <p className="mt-1 text-sm text-gray-600 line-clamp-2">{link.comment}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {readLinks.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No links available in your Linked section.</p>
                )}
              </div>
            </div>
          </div>
        }
        confirmText={confirmModalConfig.confirmText}
        type="primary"
      />

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