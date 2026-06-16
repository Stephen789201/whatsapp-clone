# Talkies - Exam Diagrams Reference Sheet

These three diagrams are simplified and structured so you can easily draw them by hand in your exam.

---

## 1. Use Case Diagram

Shows how the User and Support Admin interact with the system boundaries.

```mermaid
graph TD
    %% Actors
    User((User))
    Admin((Support Admin))
    
    %% System Boundary
    subgraph Talkies App
        UC1(Register / Log In)
        UC2(Manage Profile)
        UC3(Search & Add Friends)
        UC4(Send Messages)
        UC5(Voice / Video Call)
        UC6(Post Status Updates)
        UC7(Chat with Support)
    end
    
    %% Connections
    User --> UC1
    User --> UC2
    User --> UC3
    User --> UC4
    User --> UC5
    User --> UC6
    User --> UC7
    
    Admin --> UC7
```

---

## 2. Entity-Relationship (ER) Diagram

Represents the database structure (MongoDB collections and relationships).

```mermaid
erDiagram
    USER {
        ObjectId id PK
        String username
        String phoneNumber
        String email
        Boolean isOnline
    }
    
    CONVERSATION {
        ObjectId id PK
        Array participants FK
        ObjectId lastMessage FK
        Number unreadCount
    }
    
    MESSAGE {
        ObjectId id PK
        ObjectId conversation FK
        ObjectId sender FK
        ObjectId receiver FK
        String content
        String contentType
        String messageStatus
    }
    
    FRIEND_REQUEST {
        ObjectId id PK
        ObjectId sender FK
        ObjectId receiver FK
        String status
    }
    
    STATUS {
        ObjectId id PK
        ObjectId user FK
        String mediaUrl
        Date createdAt
    }
    
    USER ||--o{ CONVERSATION : participates
    USER ||--o{ MESSAGE : sends_receives
    USER ||--o{ FRIEND_REQUEST : sends_receives
    USER ||--o{ STATUS : posts
    CONVERSATION ||--o{ MESSAGE : contains
```

---

## 3. Class Diagram

Shows the structure of the data models and backend controller operations.

```mermaid
classDiagram
    class User {
        +ObjectId id
        +String username
        +String phoneNumber
        +String email
        +Boolean isOnline
        +Array friends
    }
    
    class Conversation {
        +ObjectId id
        +Array participants
        +ObjectId lastMessage
        +Number unreadCount
    }
    
    class Message {
        +ObjectId id
        +ObjectId conversation
        +ObjectId sender
        +ObjectId receiver
        +String content
        +String contentType
        +String messageStatus
    }
    
    class FriendRequest {
        +ObjectId id
        +ObjectId sender
        +ObjectId receiver
        +String status
    }
    
    class UserController {
        +sendOtp(req, res)
        +verifyOtp(req, res)
        +updateProfile(req, res)
        +getAllUsers(req, res)
    }
    
    class ChatController {
        +sendMessage(req, res)
        +getConversations(req, res)
        +getMessages(req, res)
        +markAsRead(req, res)
    }
    
    class FriendRequestController {
        +sendFriendRequest(req, res)
        +getFriendRequests(req, res)
        +respondToRequest(req, res)
        +getFriends(req, res)
    }
```
