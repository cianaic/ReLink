import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { format, setYear } from 'date-fns';

export default function Vault() {
  const initialLinkEntries = [{ url: '', comment: '', title: '', preview: null }];
  const [linkEntries, setLinkEntries] = useState(initialLinkEntries);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { currentUser } = useAuth();
  const functions = getFunctions();
  const fetchUrlMetadata = httpsCallable(functions, 'fetchUrlMetadata');

  // Set dates for 2024
  const now = new Date();
  const year2024 = setYear(now, 2024);
  const currentMonthKey = format(year2024, 'MMMM yyyy');

  const handleLinkChange = async (index, value) => {
    try {
      const updatedEntries = [...linkEntries];
      updatedEntries[index] = {
        ...updatedEntries[index],
        url: value
      };
      setLinkEntries(updatedEntries);

      if (value && value.match(/^https?:\/\/.+/)) {
        try {
          const result = await fetchUrlMetadata({ url: value });
          
          if (result?.data) {
            updatedEntries[index].preview = {
              ...result.data,
              url: value
            };
            setLinkEntries([...updatedEntries]);
            
            // Auto-save when we have a valid URL with preview data
            await addDoc(collection(db, "relinks"), {
              userId: currentUser.uid,
              url: value,
              comment: updatedEntries[index].comment,
              preview: result.data,
              createdAt: Timestamp.now()
            });
            
            // Clear this entry
            updatedEntries[index] = { url: '', comment: '', title: '', preview: null };
            setLinkEntries([...updatedEntries]);
            setSuccess('Link saved successfully!');
          }
        } catch (error) {
          console.error('Error fetching URL metadata:', error);
          const url = new URL(value);
          updatedEntries[index].preview = {
            title: url.hostname,
            description: '',
            image: '',
            url: value
          };
          setLinkEntries([...updatedEntries]);
        }
      } else if (!value) {
        updatedEntries[index].preview = null;
        setLinkEntries([...updatedEntries]);
      }
    } catch (error) {
      console.error('Error in handleLinkChange:', error);
      setError('Failed to save link. Please try again.');
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

  // Example November links (static data)
  const novemberLinks = [
    {
      url: 'https://github.com/features/copilot',
      comment: 'Great AI pair programming tool',
      preview: {
        title: 'GitHub Copilot · Your AI pair programmer',
        description: 'GitHub Copilot uses the OpenAI Codex to suggest code and entire functions in real-time, right from your editor.',
        image: 'https://github.githubassets.com/images/modules/site/social-cards/copilot-ga.png'
      },
      createdAt: new Date('2024-11-05')
    },
    {
      url: 'https://react.dev',
      comment: 'Official React documentation',
      preview: {
        title: 'React: The JavaScript Library for Web and Native User Interfaces',
        description: 'Build user interfaces out of individual pieces called components written in JavaScript.',
        image: 'https://react.dev/images/og-home.png'
      },
      createdAt: new Date('2024-11-10')
    },
    {
      url: 'https://firebase.google.com',
      comment: 'Firebase platform documentation',
      preview: {
        title: 'Firebase: App development platform',
        description: 'Firebase helps you build and run successful apps.',
        image: 'https://www.gstatic.com/devrel-devsite/prod/v2210075187f059b839246c2c03840474501c3c6024a99fb78f6293c7b8318a03/firebase/images/touchicon-180.png'
      },
      createdAt: new Date('2024-11-15')
    },
    {
      url: 'https://tailwindcss.com',
      comment: 'Utility-first CSS framework',
      preview: {
        title: 'Tailwind CSS - Rapidly build modern websites without ever leaving your HTML',
        description: 'A utility-first CSS framework packed with classes that can be composed to build any design, directly in your markup.',
        image: 'https://tailwindcss.com/_next/static/media/social-card-large.f6878fd8df804f73ba3f1a271122105a.jpg'
      },
      createdAt: new Date('2024-11-20')
    },
    {
      url: 'https://nextjs.org',
      comment: 'The React Framework for Production',
      preview: {
        title: 'Next.js by Vercel - The React Framework',
        description: 'Production grade React applications that scale.',
        image: 'https://nextjs.org/static/twitter-cards/home.jpg'
      },
      createdAt: new Date('2024-11-25')
    }
  ];

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
                      {entry.preview.title || new URL(entry.url).hostname}
                    </a>
                    {entry.preview.image && (
                      <div className="preview-image">
                        <img src={entry.preview.image} alt={entry.preview.title || 'Link preview'} />
                      </div>
                    )}
                    {entry.preview.description && (
                      <p className="preview-description">{entry.preview.description}</p>
                    )}
                    <div className="preview-site">
                      <span>{new URL(entry.url).hostname}</span>
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
            </div>
          ))}
        </div>
      </div>

      <div className="month-section">
        <h4 className="month-header">November 2024</h4>
        <div className="month-links">
          {novemberLinks.map((link, index) => (
            <div key={index} className="saved-link-entry">
              <div className="link-preview">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="preview-title">
                  {link.preview.title}
                </a>
                {link.preview.image && (
                  <div className="preview-image">
                    <img src={link.preview.image} alt={link.preview.title} />
                  </div>
                )}
                {link.preview.description && (
                  <p className="preview-description">{link.preview.description}</p>
                )}
                <div className="preview-meta">
                  <span className="preview-site">{new URL(link.url).hostname}</span>
                  <span className="preview-date">
                    {format(link.createdAt, 'MMM d, yyyy')}
                  </span>
                </div>
                {link.comment && (
                  <p className="saved-comment">{link.comment}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 